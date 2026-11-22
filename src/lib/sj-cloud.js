// Sparkjam: games saved to the signed-in maker's account (netlify/functions/games.mjs). The browser
// sends the sign-in cookie with each request; nothing here works when signed out.

const API = `${process.env.ROOT || '/'}api/games`;

const failure = async (response, fallback) => {
    let message = fallback;
    try {
        const body = await response.json();
        if (body && body.error) message = body.error;
    } catch (e) {
        // Not JSON: keep the fallback.
    }
    const error = new Error(message);
    error.status = response.status;
    return error;
};

/** @returns {Promise<Array<object>>} The account's games ({id, title, thumbnail, updatedAt}), newest first. */
const listCloudGames = async () => {
    const response = await fetch(API, {credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t load your account\'s games.');
    return (await response.json()).games;
};

/**
 * @param {string} id The game's id.
 * @returns {Promise<ArrayBuffer>} The game's .sb3.
 */
const loadCloudGame = async id => {
    const response = await fetch(`${API}/${encodeURIComponent(id)}`, {credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t open that game from your account.');
    return response.arrayBuffer();
};

/**
 * Save a game to the account (creating it or replacing the saved copy).
 * @param {object} game {id, title, sb3: Blob, thumbnail?: string}.
 * @returns {Promise<object>} The saved game's details.
 */
const saveCloudGame = async ({id, title, sb3, thumbnail}) => {
    const form = new FormData();
    form.append('title', title || 'Untitled game');
    if (thumbnail) form.append('thumbnail', thumbnail);
    form.append('sb3', sb3, 'game.sb3');
    const response = await fetch(`${API}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: form,
        credentials: 'same-origin'
    });
    if (!response.ok) throw await failure(response, 'Couldn\'t save to your account.');
    return (await response.json()).game;
};

const deleteCloudGame = async id => {
    const response = await fetch(`${API}/${encodeURIComponent(id)}`, {method: 'DELETE', credentials: 'same-origin'});
    if (!response.ok) throw await failure(response, 'Couldn\'t delete that game from your account.');
};

export {listCloudGames, loadCloudGame, saveCloudGame, deleteCloudGame};
