import { debugTranscript, debugLog, latencyAsr, latencyLlm, latencyTts } from "./dom.js";

export function handleDebug(msg) {
    const data = msg.data || {};
    if (msg.event === "asr_complete") {
        debugTranscript.textContent = data.transcript || "(empty)";
        latencyAsr.textContent = `${data.duration_ms} ms`;
    } else if (msg.event === "llm_complete") {
        latencyLlm.textContent = `${data.duration_ms} ms`;
    } else if (msg.event === "tts_complete") {
        latencyTts.textContent = `${data.duration_ms} ms`;
    }
    logDebug(`${msg.event}: ${JSON.stringify(data)}`);
}

export function logDebug(text) {
    const line = document.createElement("div");
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${text}`;
    debugLog.appendChild(line);
    while (debugLog.children.length > 50) {
        debugLog.removeChild(debugLog.firstChild);
    }
    debugLog.scrollTop = debugLog.scrollHeight;
}
