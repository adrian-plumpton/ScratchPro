// Sparkjam: where things live. Clean URLs (/games, /game) are rewritten to their .html files by
// netlify.toml in production and by the dev server's historyApiFallback locally.

const root = process.env.ROOT || '';

const links = {
    home: root || './',
    games: `${root}games`,
    myGames: `${root}my-games`,
    savedGame: id => `${root}editor.html?game=${encodeURIComponent(id)}`,
    sample: id => `${root}game?sample=${encodeURIComponent(id)}`,
    scratchGame: id => `${root}game#${id}`,
    remixSample: id => `${root}editor.html?sample=${encodeURIComponent(id)}`,
    remixScratch: id => `${root}editor.html#${id}`,
    newGame: `${root}editor.html?new`,
    joinJam: code => `${root}editor.html?jam=${encodeURIComponent(code)}`,
    jamOnSample: id => `${root}editor.html?sample=${encodeURIComponent(id)}&startjam`,
    jamOnScratch: id => `${root}editor.html?startjam#${id}`,
    credits: `${root}credits.html`,
    source: 'https://github.com/adrian-plumpton/scratchpro',
    turbowarp: 'https://turbowarp.org/',
    thumbnail: id => `${root}samples/${id}.svg`
};

/**
 * Pull a Scratch project number out of whatever someone pasted: a number, or a link such as
 * https://scratch.mit.edu/projects/123456/ or turbowarp.org/123456.
 * @param {string} text What was typed or pasted.
 * @returns {?string} The project number, or null.
 */
const parseScratchProject = text => {
    const match = String(text).trim()
        .match(/^(?:https?:\/\/)?(?:[\w.-]+\/)*?(?:projects\/|#)?(\d{1,12})(?:[/?#].*)?$/);
    return match ? match[1] : null;
};

export {links, parseScratchProject};
