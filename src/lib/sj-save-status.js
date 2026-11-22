// Sparkjam: the editor's "saved on this device" status, shared between the saver and the menu bar.

let status = {state: 'idle', savedAt: null};
const listeners = new Set();

const getSaveStatus = () => status;

const setSaveStatus = next => {
    status = {...status, ...next};
    listeners.forEach(listener => listener(status));
};

const onSaveStatus = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export {getSaveStatus, setSaveStatus, onSaveStatus};
