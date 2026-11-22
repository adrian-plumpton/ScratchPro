// Sparkjam: "My games", the games saved in this browser (IndexedDB). Each record holds the game's
// .sb3, a small picture of its stage, its title and when it was last edited. Accounts will add
// online saving later; this works without one.

const DB_NAME = 'sparkjam';
const DB_VERSION = 1;
const STORE = 'games';

let dbPromise = null;

/** Thrown when ?game=<id> names a game that isn't saved in this browser. */
class SavedGameMissingError extends Error {}

/**
 * @returns {Promise<IDBDatabase>} The database, opened once per page.
 */
const openDb = () => {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                reject(new Error('This browser cannot save games'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const store = request.result.createObjectStore(STORE, {keyPath: 'id'});
                store.createIndex('updatedAt', 'updatedAt');
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        // Let a later call try again if opening failed (eg. private browsing).
        dbPromise.catch(() => {
            dbPromise = null;
        });
    }
    return dbPromise;
};

const run = async (mode, action) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request ? request.result : null);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Save was cancelled'));
    });
};

const newGameId = () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * @returns {Promise<Array<object>>} Every saved game without its .sb3 data, newest first.
 */
const listGames = async () => {
    const all = await run('readonly', store => store.getAll());
    return all
        .map(game => {
            const summary = {...game};
            delete summary.sb3;
            return summary;
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
};

/**
 * @param {string} id The game's id.
 * @returns {Promise<?object>} The full record, including sb3 (a Blob), or undefined.
 */
const getGame = id => run('readonly', store => store.get(id));

/**
 * Save a game, creating it if it has no id yet.
 * @param {object} game The game: {id?, title, sb3: Blob, thumbnail?: string}.
 * @returns {Promise<string>} The game's id.
 */
const saveGame = async game => {
    const existing = game.id ? await getGame(game.id) : null;
    const record = {
        ...existing,
        ...game,
        id: game.id || newGameId(),
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now()
    };
    await run('readwrite', store => store.put(record));
    return record.id;
};

const renameGame = async (id, title) => {
    const game = await getGame(id);
    if (!game) return;
    await run('readwrite', store => store.put({...game, title}));
};

const deleteGame = id => run('readwrite', store => store.delete(id));

/**
 * "5 min ago", "yesterday" and so on.
 * @param {number} time A timestamp.
 * @param {number} [now] The current time.
 * @returns {string} How long ago it was.
 */
const timeAgo = (time, now = Date.now()) => {
    const minutes = Math.round((now - time) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(time).toLocaleDateString();
};

/**
 * @param {string} id The game's id.
 * @returns {Promise<ArrayBuffer>} The game's .sb3, for loading into the editor.
 */
const loadGameData = async id => {
    const game = await getGame(id);
    if (!game) throw new SavedGameMissingError(`Game ${id} is not saved in this browser`);
    return game.sb3.arrayBuffer();
};

export {
    SavedGameMissingError,
    loadGameData,
    listGames,
    getGame,
    saveGame,
    renameGame,
    deleteGame,
    timeAgo
};
