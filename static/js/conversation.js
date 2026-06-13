import { conversationEl } from "./dom.js";

export function addMessage(message) {
    removeEmptyState();
    const div = document.createElement("div");
    div.className = "message message-" + message.role;
    div.textContent = message.text;
    conversationEl.appendChild(div);
    conversationEl.scrollTop = conversationEl.scrollHeight;
}

export function addErrorMessage(text) {
    removeEmptyState();
    const div = document.createElement("div");
    div.className = "message message-error";
    div.textContent = text;
    conversationEl.appendChild(div);
    conversationEl.scrollTop = conversationEl.scrollHeight;
}

function removeEmptyState() {
    const empty = document.getElementById("empty-state");
    if (empty) empty.remove();
}

export function clearConversation() {
    conversationEl.innerHTML = '<div id="empty-state" class="message-empty">Your conversation will appear here.</div>';
}
