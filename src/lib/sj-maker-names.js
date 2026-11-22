// Sparkjam: maker names, picked from suggestions rather than typed, so nobody shows a real name or a
// rude word to other people. Words come from short, friendly lists.

const FIRST = [
    'Pixel', 'Neon', 'Sparky', 'Turbo', 'Cosmic', 'Lucky', 'Jolly', 'Zippy', 'Retro', 'Mega', 'Super', 'Comet',
    'Rocket', 'Laser', 'Bouncy', 'Sunny', 'Misty', 'Quiet', 'Brave', 'Clever', 'Swift', 'Fizzy', 'Glitter',
    'Velvet', 'Crystal', 'Thunder', 'Bubble', 'Sonic', 'Electric', 'Golden', 'Silver', 'Cobalt', 'Mint', 'Lime',
    'Cherry', 'Mango', 'Maple', 'Pebble', 'Frosty', 'Starry'
];
const SECOND = [
    'Fox', 'Otter', 'Comet', 'Robot', 'Panda', 'Koala', 'Falcon', 'Badger', 'Dragon', 'Tiger', 'Penguin', 'Gecko',
    'Rabbit', 'Squid', 'Owl', 'Lynx', 'Hedgehog', 'Dolphin', 'Wombat', 'Raccoon', 'Moose', 'Pixel', 'Wizard',
    'Knight', 'Ninja', 'Pilot', 'Comet', 'Meteor', 'Planet', 'Rocket', 'Sprite', 'Gizmo', 'Beetle', 'Llama',
    'Yeti', 'Phoenix', 'Golem', 'Kraken', 'Unicorn', 'Narwhal'
];

const pick = list => list[Math.floor(Math.random() * list.length)];

/**
 * @returns {string} A maker name like "PixelFox42".
 */
const makerName = () => {
    let first = pick(FIRST);
    let second = pick(SECOND);
    while (second === first) second = pick(SECOND);
    if (first === second) first = 'Mega';
    return `${first}${second}${Math.floor(Math.random() * 90) + 10}`;
};

/**
 * @param {number} count How many.
 * @returns {Array<string>} Different maker names.
 */
const makerNames = (count = 3) => {
    const names = new Set();
    while (names.size < count) names.add(makerName());
    return [...names];
};

/**
 * Whether a name could have come from the lists (so a name sent by a page can be checked).
 * @param {string} name A maker name.
 * @returns {boolean} True for names like "PixelFox42".
 */
const isMakerName = name => {
    const match = /^([A-Z][a-z]+)([A-Z][a-z]+)(\d{2})$/.exec(String(name));
    return !!match && FIRST.includes(match[1]) && SECOND.includes(match[2]);
};

export {makerName, makerNames, isMakerName};
