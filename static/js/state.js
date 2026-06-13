import { stateBadge, statusHint, talkBtn, sendBtn, stopBtn, transcriptInput } from "./dom.js";
import { addErrorMessage } from "./conversation.js";
import { logDebug } from "./debug.js";

const STATE_LABELS = {
    idle: "Idle",
    listening: "Listening",
    transcribing: "Transcribing",
    thinking: "Thinking",
    speaking: "Speaking",
    error: "Error",
};

const STATE_HINTS = {
    idle: "Hold the mic button or press and hold Space to ask a question.",
    listening: "Listening… release to stop.",
    transcribing: "Transcribing your question…",
    thinking: "Thinking about a response…",
    speaking: "Speaking — click “Stop speaking” to cancel.",
    error: "Something went wrong — see the message below.",
};

let currentState = "idle";
let errorBadgeTimeout = null;

export function getState() {
    return currentState;
}

export function setState(state) {
    currentState = state;
    clearTimeout(errorBadgeTimeout);
    renderBadge(state);

    const isIdle = state === "idle";
    talkBtn.disabled = !isIdle;
    sendBtn.disabled = !isIdle;
    transcriptInput.disabled = !isIdle;
    stopBtn.hidden = state !== "speaking";

    statusHint.textContent = STATE_HINTS[state] || "";
}

function renderBadge(state) {
    stateBadge.className = "state-badge state-" + state;
    stateBadge.textContent = STATE_LABELS[state] || state;
}

export function showError(stage, message) {
    addErrorMessage(message);
    logDebug(`Error (${stage || "general"}): ${message}`);

    renderBadge("error");
    clearTimeout(errorBadgeTimeout);
    errorBadgeTimeout = setTimeout(() => renderBadge(currentState), 2000);
}
