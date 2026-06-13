"""
Configuration: Mistral client, model identifiers, presets, and tunables.
"""

import os

from dotenv import load_dotenv
from mistralai.client import Mistral

load_dotenv()

client = Mistral(api_key=os.environ["MISTRAL_API_KEY"])

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

ASR_MODEL = "voxtral-mini-transcribe-realtime-2602"
LLM_MODEL = "mistral-small-latest"
TTS_MODEL = "voxtral-mini-tts-2603"

ASR_SAMPLE_RATE = 16000
ASR_TARGET_STREAMING_DELAY_MS = 480
ASR_TRANSCRIPT_TIMEOUT_S = 10.0

RESPONSE_CONFIG = {
    "max_tokens": 300,
    "history_limit": 20,  # most recent messages included in each LLM call
}

DEFAULT_VOICE_PREFERENCES = ["Jane - Confident", "Oliver - Cheerful", "Jane - Neutral"]

PRESETS = {
    "helper": {
        "label": "General Helper",
        "system_prompt": (
            "You are a friendly, helpful voice assistant. Answer questions "
            "clearly and concisely in a conversational tone suitable for "
            "being read aloud. Keep responses short (2-4 sentences) unless "
            "the user explicitly asks for more detail."
        ),
        "reasoning_effort": "none",
    },
    "tutor": {
        "label": "Technical Tutor",
        "system_prompt": (
            "You are a patient technical tutor. Explain programming and "
            "computer science concepts step by step, using simple language "
            "and concrete examples. Keep answers concise enough to be "
            "spoken aloud, but thorough enough to teach."
        ),
        "reasoning_effort": "high",
    },
    "course": {
        "label": "Course Q&A Assistant",
        "system_prompt": (
            "You are a course assistant answering student questions about "
            "the current course material. Be encouraging, accurate, and "
            "concise. If you are unsure of an answer, say so honestly "
            "instead of guessing."
        ),
        "reasoning_effort": "high",
    },
    "sarcastic": {
        "label": "Sarcastic Dev",
        "system_prompt": (
            "You are a sarcastic but ultimately helpful senior developer. "
            "Answer correctly and usefully, but with dry humor and playful "
            "snark. Keep it short -- a couple of sentences at most."
        ),
        "reasoning_effort": "none",
    },
}

DEFAULT_PRESET = "helper"

# voice_tags match the `languages` field returned by client.audio.voices.list()
# (e.g. "en_us", "en_gb", "fr_fr"). An empty list means no built-in voice is
# native to that language -- voice cloning via ref_audio is the only way to
# get a native accent.
LANGUAGES = {
    "auto": {"label": "Auto (match user)", "voice_tags": []},
    "en": {"label": "English", "voice_tags": ["en_us", "en_gb"]},
    "fr": {"label": "French", "voice_tags": ["fr_fr"]},
    "es": {"label": "Spanish", "voice_tags": []},
    "de": {"label": "German", "voice_tags": []},
    "it": {"label": "Italian", "voice_tags": []},
    "pt": {"label": "Portuguese", "voice_tags": []},
}

DEFAULT_LANGUAGE = "auto"

# In-memory store for zero-shot voice clones: clone_id -> base64 ref audio.
# Process-lifetime only, matches the "no persistent account system" non-goal.
CLONED_VOICES: dict[str, str] = {}
