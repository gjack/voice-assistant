"""
Per-connection session state and small WebSocket message helpers.
"""

import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

from config import DEFAULT_PRESET


@dataclass
class SessionState:
    status: str = "idle"  # idle | listening | transcribing | thinking | speaking | error
    preset: str = DEFAULT_PRESET
    voice_id: Optional[str] = None
    history: list = field(default_factory=list)
    pending_user_text: str = ""
    pending_assistant_text: str = ""
    active_asr_session: bool = False
    active_audio: bool = False
    cancel_speaking: bool = False


def make_message(role: str, text: str, source: str) -> dict:
    return {
        "id": uuid.uuid4().hex,
        "role": role,
        "text": text,
        "createdAt": time.time(),
        "source": source,
    }


async def send_state(ws: WebSocket, state: SessionState, new_status: str):
    state.status = new_status
    await ws.send_json({"type": "state", "state": new_status})


async def send_error(ws: WebSocket, state: SessionState, stage: str, message: str):
    await ws.send_json({"type": "error", "stage": stage, "message": message})
    await send_state(ws, state, "idle")


async def send_debug(ws: WebSocket, event: str, **data):
    await ws.send_json({"type": "debug", "event": event, "data": data, "ts": time.time()})
