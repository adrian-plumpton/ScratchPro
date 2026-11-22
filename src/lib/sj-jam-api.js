// Sparkjam: the jams register (netlify/functions/jams.mjs).

const API = `${process.env.ROOT || '/'}api/jams`;

const failure = async (response, fallback) => {
    let body = {};
    try {
        body = await response.json();
    } catch (e) {
        // Not JSON.
    }
    const error = new Error(body.error || fallback);
    error.status = response.status;
    error.reason = body.reason;
    return error;
};

const gameForm = (sb3, title) => {
    const form = new FormData();
    if (title) form.append('title', title);
    form.append('sb3', sb3, 'game.sb3');
    return form;
};

/**
 * Normalise "JAM-4827", "jam 4827" or "4827" to "4827".
 * @param {string} text What was typed.
 * @returns {?string} The 4-digit code, or null.
 */
const parseJamCode = text => {
    const match = /^\s*(?:jam\s*-?\s*)?(\d{4})\s*$/i.exec(String(text));
    return match ? match[1] : null;
};

const startJam = async (sb3, title) => {
    const response = await fetch(API, {method: 'POST', body: gameForm(sb3, title), credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t start a jam.');
    return (await response.json()).jam;
};

const getJam = async code => {
    const response = await fetch(`${API}/${code}`, {credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t find that jam.');
    return (await response.json()).jam;
};

const loadJamSnapshot = async code => {
    const response = await fetch(`${API}/${code}/snapshot`, {credentials: 'same-origin', cache: 'no-store'});
    if (!response.ok) throw await failure(response, 'Couldn\'t load the jam\'s game.');
    return response.arrayBuffer();
};

const saveJamSnapshot = async (code, sb3) => {
    const response = await fetch(`${API}/${code}/snapshot`, {
        method: 'PUT', body: gameForm(sb3), credentials: 'same-origin'
    });
    if (!response.ok) throw await failure(response, 'Couldn\'t share the latest game.');
};

const removeFromJam = async (code, userId) => {
    const response = await fetch(`${API}/${code}/remove`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({userId}),
        credentials: 'same-origin'
    });
    if (!response.ok) throw await failure(response, 'Couldn\'t remove them.');
};

const endJam = async code => {
    const response = await fetch(`${API}/${code}`, {method: 'DELETE', credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t end the jam.');
};

const jamLink = code => `${location.origin}${process.env.ROOT || '/'}j/${code}`;

export {parseJamCode, startJam, getJam, loadJamSnapshot, saveJamSnapshot, removeFromJam, endJam, jamLink};
