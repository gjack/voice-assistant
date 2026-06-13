# Voxtral Voice Assistant

A turn-based voice assistant web app. Hold a button, ask a question out
loud, watch the recognized transcript appear, and hear a spoken answer
back — built on Voxtral STT/TTS and Mistral's chat API.

```
mic audio -> Voxtral Realtime STT -> editable transcript
           -> mistral-small-latest -> Voxtral TTS -> playback
```

## Features

- Push-to-talk (hold button or hold Space) with streaming transcript
  preview while you speak.
- Explicit state machine: `idle`, `listening`, `transcribing`,
  `thinking`, `speaking`, `error`.
- Two-phase flow — review/edit the recognized transcript before it's
  sent to the LLM.
- Chat-style conversation view with per-session history.
- Configurable personas: General Helper, Technical Tutor, Course Q&A
  Assistant, Sarcastic Dev.
- Response language selector — reply in English, French, Spanish,
  German, Italian, or Portuguese regardless of the language the user
  spoke or typed in (steered via the LLM system prompt, since the TTS
  API has no language parameter and speaks whatever text it's given).
- Built-in Voxtral TTS voices, automatically filtered to an
  accent-matching preset when the selected response language has one
  (English/French), plus zero-shot voice cloning from a short uploaded
  clip (`ref_audio`, free-plan compatible) — the only way to get a
  native accent for languages without a built-in preset.
- Stop-speaking control, with overlapping playback prevented.
- Technical drawer showing the last transcript, ASR/LLM/TTS latency, and
  a debug log.
- Error boundaries for ASR, LLM, and TTS failures.

## Stack

- **Frontend**: vanilla HTML/CSS/JS (`static/`), served directly by the backend.
- **Backend**: FastAPI + WebSocket orchestration (`server.py`), port `8765`.
- **Models**: `voxtral-mini-transcribe-realtime-2602` (STT),
  `mistral-small-latest` (LLM), `voxtral-mini-tts-2603` (TTS).

## Quick start

```bash
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add your MISTRAL_API_KEY
python server.py
```

Open http://localhost:8765 (use `localhost`, not `127.0.0.1` — needed
for microphone access in some browsers). See
[usageInstructions.md](usageInstructions.md)
for a full walkthrough of every feature and troubleshooting tips.

## Project structure

```
voice-assistant/
├── server.py              # FastAPI app, WebSocket endpoint, control-message dispatch
├── routes.py              # REST endpoints: static page, presets, voices, languages, voice cloning
├── conversation.py         # Conversation orchestrator: LLM response + TTS playback per turn
├── asr.py                  # ASR session manager: realtime STT for one push-to-talk utterance
├── session.py              # Per-connection session state + WebSocket message helpers
├── config.py               # Mistral client, model IDs, presets, languages, tunables
├── static/
│   ├── index.html
│   ├── style.css
│   ├── app.js               # Init, dropdown wiring, WebSocket message dispatch
│   └── js/
│       ├── dom.js            # Shared DOM element references
│       ├── ws.js              # WebSocket connection helper
│       ├── state.js           # UI state machine (state badge, status hint)
│       ├── conversation.js    # Conversation feed rendering
│       ├── audio.js           # Mic capture + TTS playback
│       ├── voice-clone.js     # Voice cloning upload
│       └── debug.js           # Technical details drawer / debug log
├── requirements.txt
├── .env.example
├── SPEC.md                 # original project specification
└── usageInstructions.md    # setup, usage, troubleshooting
```

## Configuration

Models, presets (system prompts + `reasoning_effort`), response
languages (with their `voice_tags` for accent-matched voice
filtering), default voice preferences, and response limits
(`max_tokens`, history length) are all defined as structured config in
`config.py`.

## Non-goals (v1)

- No barge-in during assistant speech.
- No multiple simultaneous users or accounts.
- No memory beyond the current browser session.
- No complex tool use.
