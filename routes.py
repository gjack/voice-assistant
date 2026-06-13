"""
REST endpoints: static page, presets, voices, and voice cloning.
"""

import asyncio
import base64
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse

from config import client, PRESETS, DEFAULT_PRESET, DEFAULT_VOICE_PREFERENCES, CLONED_VOICES

STATIC_DIR = Path(__file__).parent / "static"

router = APIRouter()


@router.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


@router.get("/api/presets")
async def get_presets():
    return {
        "presets": {key: {"label": p["label"]} for key, p in PRESETS.items()},
        "default": DEFAULT_PRESET,
    }


@router.get("/api/voices")
async def get_voices():
    """List built-in TTS voices and resolve a sensible default."""
    try:
        result = await asyncio.to_thread(client.audio.voices.list, limit=50)
        voices = [{"id": v.id, "name": v.name} for v in result.items]
    except Exception as e:
        return {"voices": [], "default_voice_id": None, "error": str(e)}

    names = {v["name"]: v["id"] for v in voices}
    default_voice_id = None
    for preferred in DEFAULT_VOICE_PREFERENCES:
        if preferred in names:
            default_voice_id = names[preferred]
            break
    if default_voice_id is None and voices:
        default_voice_id = voices[0]["id"]

    return {"voices": voices, "default_voice_id": default_voice_id}


@router.post("/api/clone-voice")
async def clone_voice(file: UploadFile = File(...)):
    """Register a short reference clip for zero-shot voice cloning (free-plan ref_audio)."""
    audio_bytes = await file.read()
    ref_audio_b64 = base64.b64encode(audio_bytes).decode("ascii")

    clone_id = f"clone:{uuid.uuid4().hex[:8]}"
    CLONED_VOICES[clone_id] = ref_audio_b64

    return {"id": clone_id, "name": f"Cloned ({file.filename})"}
