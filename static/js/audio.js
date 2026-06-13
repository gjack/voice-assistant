import { talkBtn, transcriptInput } from "./dom.js";
import { send, sendBinary, isOpen } from "./ws.js";
import { getState } from "./state.js";
import { addErrorMessage } from "./conversation.js";

// --- Mic capture (mic -> PCM16 16kHz mono) ---
let audioContext = null;
let mediaStream = null;
let micSource = null;
let processorNode = null;
let streamingAudio = false;
let partialText = "";

// --- Audio playback (TTS) ---
let currentAudio = null;
let currentAudioUrl = null;

export async function startListening() {
    if (getState() !== "idle") return;
    if (!isOpen()) return;

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
        });
    } catch (e) {
        addErrorMessage("Microphone access denied.");
        return;
    }

    audioContext = new AudioContext({ sampleRate: 16000 });
    micSource = audioContext.createMediaStreamSource(mediaStream);
    processorNode = audioContext.createScriptProcessor(4096, 1, 1);

    processorNode.onaudioprocess = (e) => {
        if (!streamingAudio || !isOpen()) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
            const s = Math.max(-1, Math.min(1, float32[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        sendBinary(int16.buffer);
    };

    micSource.connect(processorNode);
    processorNode.connect(audioContext.destination);

    partialText = "";
    transcriptInput.value = "";
    transcriptInput.classList.remove("has-transcript");

    streamingAudio = true;
    talkBtn.classList.add("active");
    talkBtn.setAttribute("aria-pressed", "true");

    send({ type: "start_listening" });
}

export function stopListening() {
    if (!streamingAudio) return;
    streamingAudio = false;

    talkBtn.classList.remove("active");
    talkBtn.setAttribute("aria-pressed", "false");

    send({ type: "stop_listening" });
    teardownAudioCapture();
}

export function isStreaming() {
    return streamingAudio;
}

function teardownAudioCapture() {
    if (processorNode) {
        processorNode.disconnect();
        processorNode = null;
    }
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
    }
}

// ---------------------------------------------------------------------
// Transcript display (driven by server messages)
// ---------------------------------------------------------------------

export function appendTranscriptDelta(text) {
    partialText += text;
    transcriptInput.value = partialText;
}

export function setTranscriptText(text) {
    transcriptInput.value = text;
    transcriptInput.classList.add("has-transcript");
    transcriptInput.focus();
    transcriptInput.select();
}

// ---------------------------------------------------------------------
// TTS playback
// ---------------------------------------------------------------------

export function playAudio(b64Data, format) {
    stopCurrentAudio(false);

    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: `audio/${format}` });

    currentAudioUrl = URL.createObjectURL(blob);
    currentAudio = new Audio(currentAudioUrl);

    currentAudio.onended = () => {
        cleanupAudio();
        send({ type: "playback_finished" });
    };
    currentAudio.onerror = () => {
        cleanupAudio();
        send({ type: "playback_finished" });
    };

    currentAudio.play().catch(() => {
        cleanupAudio();
        send({ type: "playback_finished" });
    });
}

function cleanupAudio() {
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }
    currentAudio = null;
}

export function stopCurrentAudio(notifyServer = true) {
    if (currentAudio) {
        currentAudio.pause();
        cleanupAudio();
    }
    if (notifyServer) send({ type: "stop_speaking" });
}
