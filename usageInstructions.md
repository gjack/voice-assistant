# Voxtral Voice Assistant — Usage Guide

A turn-based voice assistant: ask a question out loud, review the
transcript, and hear a spoken answer back.

## 1. Setup

### Requirements
- Python 3.13
- A Mistral API key with access to Voxtral STT/TTS and `mistral-small-latest`

### Install

```bash
cd voice-assistant
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure your API key

```bash
cp .env.example .env
```

Edit `.env` and set:

```
MISTRAL_API_KEY=your-api-key-here
```

## 2. Run the server

```bash
source venv/bin/activate
python server.py
```

Open **http://localhost:8765** in your browser (not `127.0.0.1` — some
browsers only treat `localhost` as a secure-enough origin for
microphone access). Use a desktop browser (Chrome, Edge, or Firefox) —
microphone capture relies on the Web Audio API and `getUserMedia`, which
requires `localhost` or HTTPS.

## 3. Using the app

### Ask a question (voice)
1. **Hold down** the **Hold to Talk** button (or hold the **Space** bar,
   as long as you're not focused on the transcript box).
2. Speak your question. The state badge shows **Listening**, and a live
   preview of what you're saying streams into the transcript box.
3. **Release** the button/key. The badge changes to **Transcribing**
   while Voxtral finalizes the text.
4. The final transcript appears in the editable text box. Review it,
   edit it if needed, then press **Send** (or hit **Enter**).
5. The badge moves through **Thinking** (LLM is generating a reply) and
   **Speaking** (TTS audio is playing). The assistant's reply appears as
   a chat bubble and is read aloud.

### Type instead of speaking
You can skip the mic entirely — type your question into the text box and
press **Send** or **Enter**.

### Stop the assistant mid-speech
Click **Stop speaking** (visible only while the badge shows
**Speaking**) to immediately cancel playback.

### Change persona
Use the **Persona** dropdown to switch between starter prompt packs:
- **General Helper** — friendly, concise everyday assistant
- **Technical Tutor** — step-by-step explanations with examples
- **Course Q&A Assistant** — answers about the course material
- **Sarcastic Dev** — correct answers with dry humor

Changing persona takes effect on the next response; existing
conversation history is kept.

### Change response language
Use the **Language** dropdown to choose the language of the
assistant's reply — independent of the language you spoke or typed
in. The default, **Auto (match user)**, lets the LLM reply in
whatever language you used. Picking a specific language (English,
French, Spanish, German, Italian, Portuguese) adds an instruction to
the system prompt telling the assistant to always reply in that
language; the TTS audio follows automatically, since it speaks
whatever text it's given.

### Change voice / clone a voice
- Use the **Voice** dropdown to pick any built-in Voxtral TTS voice.
  When the selected response language is English or French, the list
  is automatically filtered to voices with a matching accent
  (`en_us`/`en_gb` or `fr_fr`).
- For other languages (Spanish, German, Italian, Portuguese) there's
  no built-in voice with a native accent, so the full voice list is
  shown along with a hint suggesting you clone a voice instead.
- Click **Clone voice…** to upload a short reference clip (a few
  seconds of clean speech). This registers a zero-shot cloned voice
  (via `ref_audio`, free-plan compatible) and selects it automatically.
  Cloned voices stay available regardless of the selected language and
  are kept only for the lifetime of the running server process.

### Clear the conversation
**Clear chat** wipes the on-screen history and the history sent to the
LLM for this session. Nothing is persisted to disk.

### Technical details drawer
Click **Technical details** at the bottom to expand a panel showing:
- The last recognized transcript
- Latency for the most recent ASR / LLM / TTS calls (in ms)
- A scrolling debug log of state transitions and errors

## 4. Troubleshooting

- **"Microphone access denied"** — your browser blocked mic access.
  Check the site permissions and reload.
- **No voices load / "Voice list error" in the debug log** — check that
  `MISTRAL_API_KEY` in `.env` is set and valid, then restart the server.
- **"No speech detected"** — the recording was too short or silent; hold
  the talk button a little longer and speak clearly.
- **Errors during Thinking/Speaking** — LLM or TTS errors are shown as a
  red error bubble and logged in the technical details drawer; the app
  returns to **Idle** so you can try again.
- **Nothing happens on Space** — push-to-talk via Space is disabled while
  the transcript text box or a dropdown is focused; click elsewhere on
  the page first, or use the **Hold to Talk** button.
- **Spanish/German/Italian/Portuguese replies sound accented** — the
  built-in Voxtral TTS voices only have native English (`en_us`/`en_gb`)
  and French (`fr_fr`) accents, so those languages are read by an
  English- or French-accented voice. Use **Clone voice…** with a clip of
  a native speaker to get a more natural accent.

## 5. Notes

- Conversation history, cloned voices, and session state are all
  in-memory only — restarting the server clears everything.
- The app is single-session by design (no accounts, no multi-user
  support, no long-term memory).
