// --- Connection state ---
let ws = null;
let reconnectTimer = null;

export function connectWebSocket(handlers) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
        clearTimeout(reconnectTimer);
        handlers.onOpen();
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch {
            return;
        }
        handlers.onMessage(msg);
    };

    ws.onclose = () => {
        handlers.onClose();
        reconnectTimer = setTimeout(() => connectWebSocket(handlers), 2000);
    };

    ws.onerror = () => {
        // onclose will follow and trigger reconnection
    };
}

export function isOpen() {
    return !!ws && ws.readyState === WebSocket.OPEN;
}

export function send(payload) {
    if (isOpen()) {
        ws.send(JSON.stringify(payload));
    }
}

export function sendBinary(data) {
    if (isOpen()) {
        ws.send(data);
    }
}
