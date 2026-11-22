// ScratchPro: work out which on-screen controls a project needs, by reading the keys its scripts use.

const ARROWS = {up: 'up arrow', down: 'down arrow', left: 'left arrow', right: 'right arrow'};
const WASD = {up: 'w', down: 's', left: 'a', right: 'd'};

// Sparkjam palette: yellow, cyan, pink, lavender, orange, cream. Labels are dark on all of them.
const BUTTON_COLORS = ['#ffe14d', '#36f9c6', '#ff2e88', '#c9a7ff', '#ffb347', '#f3efe6'];
const MAX_BUTTONS = 6;

const SPECIAL_KEYS = {
    'space': {key: ' ', keyCode: 32, label: 'Space'},
    'up arrow': {key: 'ArrowUp', keyCode: 38, label: '▲'},
    'down arrow': {key: 'ArrowDown', keyCode: 40, label: '▼'},
    'left arrow': {key: 'ArrowLeft', keyCode: 37, label: '◀'},
    'right arrow': {key: 'ArrowRight', keyCode: 39, label: '▶'},
    'enter': {key: 'Enter', keyCode: 13, label: 'Enter'},
    'shift': {key: 'Shift', keyCode: 16, label: 'Shift'},
    'backspace': {key: 'Backspace', keyCode: 8, label: '⌫'},
    'escape': {key: 'Escape', keyCode: 27, label: 'Esc'},
    'control': {key: 'Control', keyCode: 17, label: 'Ctrl'}
};

/**
 * Describe the browser key event the VM expects for a Scratch key name.
 * @param {string} scratchKey Scratch key name, eg. "space", "a", "up arrow".
 * @returns {{key: string, keyCode: number, label: string}} Key event info and a short label.
 */
const describeKey = scratchKey => {
    if (SPECIAL_KEYS[scratchKey]) return SPECIAL_KEYS[scratchKey];
    if (scratchKey.length === 1) {
        const upper = scratchKey.toUpperCase();
        return {key: scratchKey, keyCode: upper.charCodeAt(0), label: upper};
    }
    return {key: scratchKey, keyCode: 0, label: scratchKey.slice(0, 5)};
};

/**
 * Read every key a project's scripts listen for.
 * @param {object} vm The VM.
 * @returns {{keys: Set<string>, dynamicKeys: boolean, joystickBlocks: boolean}} What was found.
 */
const scanProject = vm => {
    const keys = new Set();
    let dynamicKeys = false;
    let joystickBlocks = false;
    const targets = (vm && vm.runtime && vm.runtime.targets) || [];
    for (const target of targets) {
        if (!target.isOriginal) continue;
        const blocks = target.blocks._blocks;
        for (const id in blocks) {
            const block = blocks[id];
            const opcode = block.opcode;
            if (opcode === 'event_whenkeypressed' || opcode === 'sensing_keyoptions') {
                const field = block.fields && block.fields.KEY_OPTION;
                if (field && typeof field.value === 'string') keys.add(field.value.toLowerCase());
            } else if (opcode === 'sensing_keypressed') {
                const input = block.inputs && block.inputs.KEY_OPTION;
                // A reporter dropped into "key () pressed?" means we can't know the key in advance.
                if (input && input.block && input.block !== input.shadow) dynamicKeys = true;
            } else if (typeof opcode === 'string' && opcode.startsWith('sptouch_joystick')) {
                joystickBlocks = true;
            }
        }
    }
    return {keys, dynamicKeys, joystickBlocks};
};

/**
 * @typedef {object} TouchConfig
 * @property {?{up: string, down: string, left: string, right: string}} joystick Scratch keys the stick presses.
 * @property {Array<{scratchKey: string, key: string, keyCode: number, label: string, color: string}>} buttons
 */

/**
 * Decide the on-screen controls for a project.
 * @param {object} vm The VM.
 * @returns {TouchConfig} The controls to show. Empty when the game only needs taps.
 */
const getTouchConfig = vm => {
    const {keys, dynamicKeys, joystickBlocks} = scanProject(vm);
    const uses = k => keys.has(k);
    const usesArrows = Object.values(ARROWS).some(uses);
    const usesWasd = Object.values(WASD).some(uses);

    let joystick = null;
    if (usesArrows || joystickBlocks || dynamicKeys) {
        joystick = ARROWS;
    } else if (usesWasd) {
        joystick = WASD;
    }

    const covered = new Set(joystick ? Object.values(joystick) : []);
    // With arrows on the stick, WASD is usually a second player: leave it off rather than add 4 buttons.
    if (joystick === ARROWS) Object.values(WASD).forEach(k => covered.add(k));

    const buttonKeys = [];
    if (uses('space')) buttonKeys.push('space');
    Array.from(keys)
        .filter(k => k !== 'space' && k !== 'any' && !covered.has(k) && !ARROWS[k])
        .sort()
        .forEach(k => buttonKeys.push(k));
    if (!buttonKeys.length && (uses('any') || dynamicKeys)) buttonKeys.push('space');

    const buttons = buttonKeys.slice(0, MAX_BUTTONS).map((scratchKey, i) => ({
        scratchKey,
        ...describeKey(scratchKey),
        color: BUTTON_COLORS[i % BUTTON_COLORS.length]
    }));

    return {joystick, buttons};
};

const configsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export {
    describeKey,
    scanProject,
    getTouchConfig,
    configsEqual
};
