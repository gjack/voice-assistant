"""
Conversation orchestrator -- LLM response + TTS playback for one turn.
"""

import asyncio
import time

from fastapi import WebSocket

from config import client, LLM_MODEL, TTS_MODEL, PRESETS, DEFAULT_PRESET, RESPONSE_CONFIG, CLONED_VOICES
from session import SessionState, make_message, send_state, send_error, send_debug


async def handle_response(ws: WebSocket, state: SessionState, user_text: str):
    await send_state(ws, state, "thinking")
    state.cancel_speaking = False
    state.pending_user_text = user_text

    state.history.append({"role": "user", "content": user_text})
    await ws.send_json({"type": "message", "message": make_message("user", user_text, "voice")})

    preset = PRESETS.get(state.preset, PRESETS[DEFAULT_PRESET])
    messages = [{"role": "system", "content": preset["system_prompt"]}]
    messages.extend(state.history[-RESPONSE_CONFIG["history_limit"]:])

    t0 = time.monotonic()
    try:
        response = await asyncio.to_thread(
            client.chat.complete,
            model=LLM_MODEL,
            messages=messages,
            max_tokens=RESPONSE_CONFIG["max_tokens"],
            reasoning_effort=preset["reasoning_effort"],
        )
        answer = response.choices[0].message.content
        if isinstance(answer, list):
            answer = "".join(getattr(block, "text", "") for block in answer)
        answer = answer.strip()
    except Exception as e:
        await send_error(ws, state, "llm", f"I couldn't generate a response: {e}")
        return

    await send_debug(ws, "llm_complete", duration_ms=int((time.monotonic() - t0) * 1000))

    if not answer:
        await send_error(ws, state, "llm", "The assistant returned an empty response.")
        return

    state.pending_assistant_text = answer
    state.history.append({"role": "assistant", "content": answer})
    await ws.send_json({"type": "message", "message": make_message("assistant", answer, "llm")})

    await send_state(ws, state, "speaking")
    state.active_audio = True

    t1 = time.monotonic()
    try:
        tts_kwargs = {"model": TTS_MODEL, "input": answer, "response_format": "mp3"}
        if state.voice_id and state.voice_id.startswith("clone:"):
            tts_kwargs["ref_audio"] = CLONED_VOICES.get(state.voice_id)
        elif state.voice_id:
            tts_kwargs["voice_id"] = state.voice_id

        tts_response = await asyncio.to_thread(client.audio.speech.complete, **tts_kwargs)
    except Exception as e:
        state.active_audio = False
        await send_error(ws, state, "tts", f"I couldn't generate speech: {e}")
        return

    await send_debug(ws, "tts_complete", duration_ms=int((time.monotonic() - t1) * 1000))

    if state.cancel_speaking:
        state.active_audio = False
        state.cancel_speaking = False
        await send_state(ws, state, "idle")
        return

    await ws.send_json({"type": "audio", "data": tts_response.audio_data, "format": "mp3"})
    # state remains "speaking" until the client reports playback_finished / stop_speaking
