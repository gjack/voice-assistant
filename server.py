"""
Voxtral Voice Assistant -- FastAPI backend.

Turn-based pipeline:
    mic audio -> Voxtral Realtime STT -> editable transcript
    -> Mistral LLM (mistral-small-latest) -> Voxtral TTS -> playback

Run:  python server.py
Open: http://127.0.0.1:8765
"""

import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from asr import handle_listening
from config import PRESETS, LANGUAGES
from conversation import handle_response
from routes import router
from session import SessionState, send_state

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

app.include_router(router)


# ---------------------------------------------------------------------------
# WebSocket orchestration
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    state = SessionState()

    await ws.send_json({
        "type": "ready",
        "preset": state.preset,
        "presets": {key: {"label": p["label"]} for key, p in PRESETS.items()},
    })
    await send_state(ws, state, "idle")

    try:
        while True:
            message = await ws.receive()

            if message["type"] == "websocket.disconnect":
                break

            if message.get("text") is not None:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue
                await handle_control_message(ws, state, data)

            # Stray binary frames outside an active listening session are ignored.

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await ws.send_json({"type": "error", "stage": "general", "message": str(e)})
        except Exception:
            pass


async def handle_control_message(ws: WebSocket, state: SessionState, data: dict):
    msg_type = data.get("type")

    if msg_type == "set_preset":
        preset = data.get("preset")
        if preset in PRESETS:
            state.preset = preset

    elif msg_type == "set_voice":
        state.voice_id = data.get("voice_id") or None

    elif msg_type == "set_language":
        language = data.get("language")
        if language in LANGUAGES:
            state.language = language

    elif msg_type == "clear_history":
        state.history.clear()
        await ws.send_json({"type": "history_cleared"})

    elif msg_type == "start_listening":
        if state.status != "idle":
            return
        await handle_listening(ws, state)

    elif msg_type == "send_message":
        if state.status != "idle":
            return
        text = " ".join((data.get("text") or "").split())
        if not text:
            return
        await handle_response(ws, state, text)

    elif msg_type == "stop_speaking":
        state.cancel_speaking = True
        if state.status == "speaking":
            state.active_audio = False
            await send_state(ws, state, "idle")

    elif msg_type == "playback_finished":
        state.active_audio = False
        if state.status == "speaking":
            await send_state(ws, state, "idle")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8765)
