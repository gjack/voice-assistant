"""
ASR session manager -- realtime STT for a single push-to-talk utterance.
"""

import asyncio
import json
import time
from typing import Optional

from fastapi import WebSocket

from mistralai.client.models import (
    AudioFormat,
    TranscriptionStreamTextDelta,
    TranscriptionStreamSegmentDelta,
    TranscriptionStreamDone,
    RealtimeTranscriptionSessionCreated,
    RealtimeTranscriptionError,
)
from mistralai.extra.realtime import UnknownRealtimeEvent

from config import (
    client,
    ASR_MODEL,
    ASR_SAMPLE_RATE,
    ASR_TARGET_STREAMING_DELAY_MS,
    ASR_TRANSCRIPT_TIMEOUT_S,
)
from session import SessionState, send_state, send_error, send_debug


async def handle_listening(ws: WebSocket, state: SessionState):
    await send_state(ws, state, "listening")
    state.active_asr_session = True
    t_start = time.monotonic()

    try:
        connection = await client.audio.realtime.connect(
            model=ASR_MODEL,
            audio_format=AudioFormat(encoding="pcm_s16le", sample_rate=ASR_SAMPLE_RATE),
            target_streaming_delay_ms=ASR_TARGET_STREAMING_DELAY_MS,
        )
    except Exception as e:
        state.active_asr_session = False
        await send_error(ws, state, "asr", f"Could not start transcription: {e}")
        return

    transcript_segments: list[str] = []
    final_text: Optional[str] = None

    async def receive_audio():
        """Forward mic audio to Voxtral until the client signals stop."""
        try:
            while True:
                message = await ws.receive()
                if message["type"] == "websocket.disconnect":
                    break
                if message.get("bytes") is not None:
                    await connection.send_audio(message["bytes"])
                elif message.get("text") is not None:
                    try:
                        control = json.loads(message["text"])
                    except json.JSONDecodeError:
                        continue
                    if control.get("type") == "stop_listening":
                        break
        finally:
            await connection.flush_audio()
            await connection.end_audio()

    async def process_events():
        """Collect transcript events from the Voxtral realtime stream."""
        nonlocal final_text
        async for event in connection:
            if isinstance(event, TranscriptionStreamTextDelta):
                await ws.send_json({"type": "transcript_delta", "text": event.text})
            elif isinstance(event, TranscriptionStreamSegmentDelta):
                transcript_segments.append(event.text)
            elif isinstance(event, TranscriptionStreamDone):
                final_text = event.text
                break
            elif isinstance(event, RealtimeTranscriptionError):
                raise RuntimeError(event.error.message)
            elif isinstance(event, RealtimeTranscriptionSessionCreated):
                pass
            elif isinstance(event, UnknownRealtimeEvent):
                pass

    receive_task = asyncio.create_task(receive_audio())
    events_task = asyncio.create_task(process_events())

    # Wait for the client to release the talk button (or disconnect).
    await receive_task
    await send_state(ws, state, "transcribing")

    try:
        await asyncio.wait_for(events_task, timeout=ASR_TRANSCRIPT_TIMEOUT_S)
    except asyncio.TimeoutError:
        events_task.cancel()
    except Exception as e:
        await connection.close()
        state.active_asr_session = False
        await send_error(ws, state, "asr", f"Transcription error: {e}")
        return

    await connection.close()
    state.active_asr_session = False

    duration_ms = int((time.monotonic() - t_start) * 1000)
    raw_text = final_text if final_text is not None else "".join(transcript_segments)
    normalized = " ".join(raw_text.split())  # trim + collapse whitespace

    await send_debug(ws, "asr_complete", transcript=normalized, duration_ms=duration_ms)

    if not normalized:
        await send_state(ws, state, "idle")
        await send_error(ws, state, "asr", "No speech detected -- please try again.")
        return

    state.pending_user_text = normalized
    await ws.send_json({"type": "transcript", "text": normalized})
    await send_state(ws, state, "idle")
