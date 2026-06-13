import { voiceSelect } from "./dom.js";
import { send } from "./ws.js";
import { logDebug } from "./debug.js";
import { addErrorMessage } from "./conversation.js";

export async function handleCloneUpload(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/clone-voice", { method: "POST", body: formData });
        const data = await res.json();

        const opt = document.createElement("option");
        opt.value = data.id;
        opt.textContent = data.name;
        voiceSelect.appendChild(opt);
        voiceSelect.value = data.id;

        send({ type: "set_voice", voice_id: data.id });
        logDebug(`Cloned voice registered: ${data.name}`);
    } catch (e) {
        addErrorMessage(`Voice cloning failed: ${e.message}`);
    }
}
