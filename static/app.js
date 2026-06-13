import {
    presetSelect,
    voiceSelect,
    languageSelect,
    voiceHint,
    cloneBtn,
    cloneFile,
    clearBtn,
    talkBtn,
    sendBtn,
    stopBtn,
    transcriptInput,
} from "./js/dom.js";
import { connectWebSocket, send } from "./js/ws.js";
import { setState, getState, showError } from "./js/state.js";
import { addMessage, clearConversation } from "./js/conversation.js";
import { handleDebug, logDebug } from "./js/debug.js";
import {
    startListening,
    stopListening,
    isStreaming,
    playAudio,
    stopCurrentAudio,
    appendTranscriptDelta,
    setTranscriptText,
} from "./js/audio.js";
import { handleCloneUpload } from "./js/voice-clone.js";

// ---------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------

// Built-in voices from /api/voices, each with a `languages` tag list.
let builtinVoices = [];
let defaultVoiceId = null;
// Voices registered via "Clone voice…" this session.
let clonedVoices = [];
// language code -> { label, voice_tags } from /api/languages.
let languageInfo = {};

async function init() {
    await Promise.all([loadPresets(), loadVoices(), loadLanguages()]);
    applyVoiceFilter();
    connectWebSocket({
        onOpen: () => {
            send({ type: "set_preset", preset: presetSelect.value });
            send({ type: "set_voice", voice_id: voiceSelect.value });
            send({ type: "set_language", language: languageSelect.value });
            logDebug("Connected to server.");
        },
        onMessage: handleMessage,
        onClose: () => {
            logDebug("Disconnected — retrying in 2s…");
            setState("idle");
        },
    });
}

async function loadPresets() {
    try {
        const res = await fetch("/api/presets");
        const data = await res.json();
        presetSelect.textContent = "";
        Object.entries(data.presets).forEach(([key, info]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = info.label;
            presetSelect.appendChild(opt);
        });
        if (data.default) presetSelect.value = data.default;
    } catch (e) {
        logDebug(`Failed to load presets: ${e.message}`);
    }
}

async function loadLanguages() {
    try {
        const res = await fetch("/api/languages");
        const data = await res.json();
        languageInfo = data.languages;
        languageSelect.textContent = "";
        Object.entries(data.languages).forEach(([key, info]) => {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = info.label;
            languageSelect.appendChild(opt);
        });
        if (data.default) languageSelect.value = data.default;
    } catch (e) {
        logDebug(`Failed to load languages: ${e.message}`);
    }
}

async function loadVoices() {
    try {
        const res = await fetch("/api/voices");
        const data = await res.json();
        builtinVoices = data.voices;
        defaultVoiceId = data.default_voice_id;
        if (data.error) logDebug(`Voice list error: ${data.error}`);
    } catch (e) {
        logDebug(`Failed to load voices: ${e.message}`);
    }
}

// Rebuild the voice dropdown for the currently selected language: prefer
// built-in voices whose `languages` tag matches, always keep cloned voices,
// and surface a hint when no built-in voice is native to that language.
function applyVoiceFilter() {
    const lang = languageSelect.value;
    const tags = languageInfo[lang]?.voice_tags || [];
    const previous = voiceSelect.value;

    let matching = builtinVoices;
    if (tags.length) {
        const filtered = builtinVoices.filter((v) => v.languages.some((l) => tags.includes(l)));
        if (filtered.length) matching = filtered;
    }

    voiceSelect.textContent = "";
    [...matching, ...clonedVoices].forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = v.name;
        voiceSelect.appendChild(opt);
    });

    const values = [...voiceSelect.options].map((o) => o.value);
    if (values.includes(previous)) {
        voiceSelect.value = previous;
    } else if (defaultVoiceId && values.includes(defaultVoiceId)) {
        voiceSelect.value = defaultVoiceId;
    }

    const noNativeVoice = lang !== "auto" && tags.length === 0;
    voiceHint.hidden = !noNativeVoice;
    if (noNativeVoice) {
        const label = languageInfo[lang]?.label || lang;
        voiceHint.textContent =
            `No built-in voice is native to ${label}. For a more natural accent, ` +
            `try "Clone voice…" with a ${label} speaker clip.`;
    }
}

// ---------------------------------------------------------------------
// Incoming WebSocket message dispatch
// ---------------------------------------------------------------------

function handleMessage(msg) {
    switch (msg.type) {
        case "ready":
            break;

        case "state":
            setState(msg.state);
            break;

        case "transcript_delta":
            appendTranscriptDelta(msg.text);
            break;

        case "transcript":
            setTranscriptText(msg.text);
            break;

        case "message":
            addMessage(msg.message);
            break;

        case "audio":
            playAudio(msg.data, msg.format);
            break;

        case "error":
            showError(msg.stage, msg.message);
            break;

        case "debug":
            handleDebug(msg);
            break;

        case "history_cleared":
            clearConversation();
            break;
    }
}

// ---------------------------------------------------------------------
// Send (final) message to LLM + TTS
// ---------------------------------------------------------------------

function sendMessage() {
    if (getState() !== "idle") return;
    const text = transcriptInput.value.trim();
    if (!text) return;

    transcriptInput.value = "";
    transcriptInput.classList.remove("has-transcript");

    send({ type: "send_message", text });
}

// ---------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------

talkBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startListening();
});
talkBtn.addEventListener("mouseup", () => stopListening());
talkBtn.addEventListener("mouseleave", () => { if (isStreaming()) stopListening(); });

talkBtn.addEventListener("touchstart", (e) => {
    e.preventDefault();
    startListening();
});
talkBtn.addEventListener("touchend", (e) => {
    e.preventDefault();
    stopListening();
});

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && document.activeElement !== transcriptInput
        && document.activeElement.tagName !== "SELECT") {
        e.preventDefault();
        startListening();
    }
});
document.addEventListener("keyup", (e) => {
    if (e.code === "Space" && document.activeElement !== transcriptInput
        && document.activeElement.tagName !== "SELECT") {
        e.preventDefault();
        stopListening();
    }
});

sendBtn.addEventListener("click", sendMessage);
transcriptInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

stopBtn.addEventListener("click", () => stopCurrentAudio(true));

clearBtn.addEventListener("click", () => send({ type: "clear_history" }));

presetSelect.addEventListener("change", () => send({ type: "set_preset", preset: presetSelect.value }));
voiceSelect.addEventListener("change", () => send({ type: "set_voice", voice_id: voiceSelect.value }));
languageSelect.addEventListener("change", () => {
    applyVoiceFilter();
    send({ type: "set_language", language: languageSelect.value });
    send({ type: "set_voice", voice_id: voiceSelect.value });
});

cloneBtn.addEventListener("click", () => cloneFile.click());
cloneFile.addEventListener("change", async (e) => {
    if (e.target.files[0]) {
        const cloned = await handleCloneUpload(e.target.files[0]);
        if (cloned) {
            clonedVoices.push({ id: cloned.id, name: cloned.name });
            applyVoiceFilter();
            voiceSelect.value = cloned.id;
            send({ type: "set_voice", voice_id: cloned.id });
        }
    }
    cloneFile.value = "";
});

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------

init();
