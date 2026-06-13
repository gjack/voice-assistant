import { logDebug } from "./debug.js";
import { addErrorMessage } from "./conversation.js";

export async function handleCloneUpload(file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/clone-voice", { method: "POST", body: formData });
        const data = await res.json();
        logDebug(`Cloned voice registered: ${data.name}`);
        return data;
    } catch (e) {
        addErrorMessage(`Voice cloning failed: ${e.message}`);
        return null;
    }
}
