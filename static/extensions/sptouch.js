// ScratchPro Phone (extension id "sptouch"): blocks for games played on phones and tablets.
// Joystick, fingers, swipes, tilt, vibration, saving progress on the device, and on-screen controls.
// Runs unsandboxed (ScratchPro trusts its own /extensions/sp*.js) so it can read the on-screen
// joystick state that ScratchPro publishes on window.ScratchProTouch.
(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('ScratchPro Phone must run unsandboxed');
    }

    const vm = Scratch.vm;
    const runtime = vm.runtime;
    const EXTENSION_ID = 'sptouch';

    const touch = () => window.ScratchProTouch || null;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    // ---------------------------------------------------------------- fingers and swipes

    // Fingers (and the mouse, for testing on a computer) currently pressed on the stage, oldest first.
    const fingers = new Map();
    // Where each finger started, to spot swipes.
    const swipeStarts = new Map();
    let lastSwipe = '';

    // A swipe is a quick, mostly straight drag of at least this many screen pixels.
    const SWIPE_MIN_DISTANCE = 30;
    const SWIPE_MAX_TIME = 700;

    const getCanvas = () => runtime.renderer && runtime.renderer.canvas;

    const toStage = (clientX, clientY) => {
        const canvas = getCanvas();
        const rect = canvas.getBoundingClientRect();
        const w = runtime.stageWidth;
        const h = runtime.stageHeight;
        const x = ((clientX - rect.left) / rect.width * w) - (w / 2);
        const y = (h / 2) - ((clientY - rect.top) / rect.height * h);
        return {
            x: Math.round(clamp(x, -w / 2, w / 2)),
            y: Math.round(clamp(y, -h / 2, h / 2))
        };
    };

    const swipeDirection = (dx, dy) => {
        // dy is in screen pixels, so positive is down
        if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
        return dy > 0 ? 'down' : 'up';
    };

    const startSwipeHats = direction => {
        runtime.startHats(`${EXTENSION_ID}_whenSwiped`, {DIRECTION: direction});
        runtime.startHats(`${EXTENSION_ID}_whenSwiped`, {DIRECTION: 'any'});
    };

    const onDown = e => {
        if (e.target !== getCanvas()) return;
        fingers.set(e.pointerId, toStage(e.clientX, e.clientY));
        swipeStarts.set(e.pointerId, {x: e.clientX, y: e.clientY, time: Date.now()});
    };
    const onMove = e => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, toStage(e.clientX, e.clientY));
    };
    const onUp = e => {
        fingers.delete(e.pointerId);
        const start = swipeStarts.get(e.pointerId);
        swipeStarts.delete(e.pointerId);
        if (!start || e.type === 'pointercancel') return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.hypot(dx, dy) >= SWIPE_MIN_DISTANCE && Date.now() - start.time <= SWIPE_MAX_TIME) {
            lastSwipe = swipeDirection(dx, dy);
            startSwipeHats(lastSwipe);
        }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', () => {
        fingers.clear();
        swipeStarts.clear();
    });

    const finger = n => Array.from(fingers.values())[Math.floor(Scratch.Cast.toNumber(n)) - 1] || null;

    // ---------------------------------------------------------------- joystick

    const joystick = () => {
        const t = touch();
        return t ? t.joystick : {x: 0, y: 0, active: false};
    };
    const joystickDistance = () => {
        const j = joystick();
        return Math.min(100, Math.round(Math.hypot(j.x, j.y) * 100));
    };
    let lastDirection = 90;
    const joystickDirection = () => {
        const j = joystick();
        if (j.active && Math.hypot(j.x, j.y) > 0.1) {
            // Scratch directions: 0 is up, 90 is right, -90 is left, 180 is down.
            lastDirection = Math.round(Math.atan2(j.x, j.y) * 180 / Math.PI);
        }
        return lastDirection;
    };
    const joystickMoved = () => joystick().active && joystickDistance() >= 15;

    // ---------------------------------------------------------------- tilt

    // Degrees of tilt that count as all the way (100).
    const TILT_RANGE = 45;
    // How far (out of 100) the phone must tilt for "when phone tilted".
    const TILT_TRIGGER = 35;

    // side: + when tilted right. front: + when the top edge tilts away from the player.
    let tiltReading = null;
    let tiltCentre = null;

    const screenAngle = () => {
        let angle = 0;
        if (window.screen && screen.orientation && typeof screen.orientation.angle === 'number') {
            angle = screen.orientation.angle;
        } else if (typeof window.orientation === 'number') {
            angle = window.orientation;
        }
        return ((angle % 360) + 360) % 360;
    };

    const onOrientation = e => {
        if (e.beta === null || e.gamma === null || typeof e.beta !== 'number') return;
        // beta: front/back tilt, gamma: left/right tilt, both relative to the device held upright.
        // Turn them into tilt relative to the screen as the player sees it.
        let side;
        let front;
        switch (screenAngle()) {
        case 90:
            side = e.beta;
            front = e.gamma;
            break;
        case 180:
            side = -e.gamma;
            front = e.beta;
            break;
        case 270:
            side = -e.beta;
            front = -e.gamma;
            break;
        default:
            side = e.gamma;
            front = -e.beta;
        }
        tiltReading = {side, front};
        // The way the player first holds the phone counts as level.
        if (tiltCentre === null) tiltCentre = {side: 0, front};
    };
    window.addEventListener('deviceorientation', onOrientation);
    if (window.screen && screen.orientation && screen.orientation.addEventListener) {
        // Holding the phone the other way round: start again from how it is held now.
        screen.orientation.addEventListener('change', () => {
            tiltCentre = null;
        });
    }

    const tiltX = () => {
        if (!tiltReading || !tiltCentre) return 0;
        return Math.round(clamp((tiltReading.side - tiltCentre.side) / TILT_RANGE * 100, -100, 100));
    };
    const tiltY = () => {
        if (!tiltReading || !tiltCentre) return 0;
        return Math.round(clamp((tiltReading.front - tiltCentre.front) / TILT_RANGE * 100, -100, 100));
    };

    // iPhone and iPad only give tilt readings after the player allows it, which has to happen
    // from a tap. Ask on the first tap, but only for games that use the tilt blocks.
    let tiltPermissionAsked = false;
    const projectUsesTilt = () => runtime.targets.some(target => {
        const blocks = target.blocks && target.blocks._blocks;
        if (!blocks) return false;
        return Object.keys(blocks).some(id => {
            const opcode = blocks[id].opcode;
            return opcode === `${EXTENSION_ID}_tiltX` || opcode === `${EXTENSION_ID}_tiltY` ||
                opcode === `${EXTENSION_ID}_whenTilted` || opcode === `${EXTENSION_ID}_isTilted`;
        });
    });
    const askTiltPermission = () => {
        if (tiltPermissionAsked) return;
        const Orientation = window.DeviceOrientationEvent;
        if (!Orientation || typeof Orientation.requestPermission !== 'function') {
            tiltPermissionAsked = true;
            return;
        }
        if (!projectUsesTilt()) return;
        tiltPermissionAsked = true;
        Orientation.requestPermission().catch(() => {});
    };
    document.addEventListener('pointerup', askTiltPermission, true);

    const isTilted = direction => {
        switch (Scratch.Cast.toString(direction).toLowerCase()) {
        case 'left': return tiltX() <= -TILT_TRIGGER;
        case 'right': return tiltX() >= TILT_TRIGGER;
        case 'forward': return tiltY() >= TILT_TRIGGER;
        case 'back': return tiltY() <= -TILT_TRIGGER;
        default: return Math.max(Math.abs(tiltX()), Math.abs(tiltY())) >= TILT_TRIGGER;
        }
    };

    // ---------------------------------------------------------------- saving on the device

    // Saves belong to one game. A game from Scratch is known by its project ID; otherwise by the
    // names of its sprites, so the same game shares saves in the editor and on the play page.
    const hashString = text => {
        let hash = 5381;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
        }
        return hash.toString(36);
    };
    const gameKey = () => {
        const idMatch = location.hash.match(/#(\d+)/);
        if (idMatch) return `id${idMatch[1]}`;
        const names = runtime.targets
            .filter(target => target.isOriginal && !target.isStage)
            .map(target => target.getName())
            .sort()
            .join('|');
        return `g${hashString(names)}`;
    };
    const storageKey = name => {
        const cleanName = Scratch.Cast.toString(name)
            .trim()
            .toLowerCase();
        return `sp:save:${gameKey()}:${cleanName}`;
    };
    const MAX_SAVE_LENGTH = 10000;
    // Used when the browser blocks storage (eg. some private modes), so saves last until the page closes.
    const memorySaves = new Map();

    const writeSave = (name, value) => {
        const key = storageKey(name);
        const text = Scratch.Cast.toString(value).slice(0, MAX_SAVE_LENGTH);
        memorySaves.set(key, text);
        try {
            localStorage.setItem(key, text);
        } catch (e) {
            // storage full or blocked: the in-memory copy still works for this visit
        }
    };
    const readSave = name => {
        const key = storageKey(name);
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) return stored;
        } catch (e) {
            // storage blocked
        }
        return memorySaves.has(key) ? memorySaves.get(key) : null;
    };
    const deleteSave = name => {
        const key = storageKey(name);
        memorySaves.delete(key);
        try {
            localStorage.removeItem(key);
        } catch (e) {
            // storage blocked
        }
    };

    // ---------------------------------------------------------------- other

    const isTouchDevice = () => {
        const t = touch();
        if (t && t.isTouchDevice) return !!t.isTouchDevice();
        return window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    };

    const isPortrait = () => {
        if (window.matchMedia) return window.matchMedia('(orientation: portrait)').matches;
        return window.innerHeight > window.innerWidth;
    };

    const ICON = `data:image/svg+xml;base64,${btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
        '<circle cx="20" cy="20" r="19" fill="#4f46e5" stroke="#3730a3" stroke-width="2"/>' +
        '<rect x="7" y="13" width="26" height="15" rx="7.5" fill="#fff"/>' +
        '<path d="M13 17v3h-3v2h3v3h2v-3h3v-2h-3v-3z" fill="#4f46e5"/>' +
        '<circle cx="25" cy="19" r="2" fill="#ef4444"/><circle cx="28.5" cy="23" r="2" fill="#3b82f6"/>' +
        '</svg>'
    )}`;

    class ScratchProPhone {
        getInfo () {
            return {
                id: EXTENSION_ID,
                name: 'Phone',
                color1: '#4f46e5',
                color2: '#4338ca',
                color3: '#3730a3',
                menuIconURI: ICON,
                docsURI: 'https://github.com/adrian-plumpton/ScratchPro#phone-blocks',
                blocks: [
                    {
                        opcode: 'joystickWhenMoved',
                        blockType: Scratch.BlockType.HAT,
                        isEdgeActivated: true,
                        text: 'when joystick moved'
                    },
                    {
                        opcode: 'joystickMoved',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'joystick moved?'
                    },
                    {
                        opcode: 'joystickDirection',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'joystick direction'
                    },
                    {
                        opcode: 'joystickDistance',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'joystick distance'
                    },
                    {
                        opcode: 'joystickX',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'joystick x'
                    },
                    {
                        opcode: 'joystickY',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'joystick y'
                    },
                    '---',
                    {
                        opcode: 'whenSwiped',
                        blockType: Scratch.BlockType.HAT,
                        isEdgeActivated: false,
                        shouldRestartExistingThreads: true,
                        text: 'when swiped [DIRECTION]',
                        arguments: {
                            DIRECTION: {type: Scratch.ArgumentType.STRING, menu: 'swipeDirections', defaultValue: 'any'}
                        }
                    },
                    {
                        opcode: 'lastSwipe',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'last swipe direction'
                    },
                    {
                        opcode: 'touchingStage',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'finger on stage?'
                    },
                    {
                        opcode: 'fingerCount',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'number of fingers'
                    },
                    {
                        opcode: 'fingerX',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'finger [N] x',
                        arguments: {N: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}}
                    },
                    {
                        opcode: 'fingerY',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'finger [N] y',
                        arguments: {N: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}}
                    },
                    '---',
                    {
                        opcode: 'whenTilted',
                        blockType: Scratch.BlockType.HAT,
                        isEdgeActivated: true,
                        text: 'when phone tilted [DIRECTION]',
                        arguments: {
                            DIRECTION: {type: Scratch.ArgumentType.STRING, menu: 'tiltDirections', defaultValue: 'left'}
                        }
                    },
                    {
                        opcode: 'isTilted',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'phone tilted [DIRECTION]?',
                        arguments: {
                            DIRECTION: {type: Scratch.ArgumentType.STRING, menu: 'tiltDirections', defaultValue: 'left'}
                        }
                    },
                    {
                        opcode: 'tiltX',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'tilt left/right'
                    },
                    {
                        opcode: 'tiltY',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'tilt forward/back'
                    },
                    {
                        opcode: 'resetTilt',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'make the way the phone is held now level'
                    },
                    '---',
                    {
                        opcode: 'save',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'save [VALUE] as [NAME]',
                        arguments: {
                            VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: '0'},
                            NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'high score'}
                        }
                    },
                    {
                        opcode: 'load',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'saved [NAME]',
                        arguments: {
                            NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'high score'}
                        }
                    },
                    {
                        opcode: 'isSaved',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: '[NAME] is saved?',
                        arguments: {
                            NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'high score'}
                        }
                    },
                    {
                        opcode: 'deleteSave',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'delete saved [NAME]',
                        arguments: {
                            NAME: {type: Scratch.ArgumentType.STRING, defaultValue: 'high score'}
                        }
                    },
                    '---',
                    {
                        opcode: 'setControls',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '[MODE] touch controls',
                        arguments: {MODE: {type: Scratch.ArgumentType.STRING, menu: 'showHide', defaultValue: 'hide'}}
                    },
                    {
                        opcode: 'vibrate',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'vibrate for [MS] milliseconds',
                        arguments: {MS: {type: Scratch.ArgumentType.NUMBER, defaultValue: 50}}
                    },
                    {
                        opcode: 'isTouchScreen',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'using touch screen?'
                    },
                    {
                        opcode: 'isPortrait',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: 'screen is portrait?'
                    }
                ],
                menus: {
                    showHide: {
                        acceptReporters: true,
                        items: ['show', 'hide']
                    },
                    swipeDirections: {
                        acceptReporters: false,
                        items: ['any', 'left', 'right', 'up', 'down']
                    },
                    tiltDirections: {
                        acceptReporters: true,
                        items: ['left', 'right', 'forward', 'back', 'any way']
                    }
                }
            };
        }

        joystickWhenMoved () {
            return joystickMoved();
        }
        joystickMoved () {
            return joystickMoved();
        }
        joystickDirection () {
            return joystickDirection();
        }
        joystickDistance () {
            return joystickDistance();
        }
        joystickX () {
            return Math.round(joystick().x * 100);
        }
        joystickY () {
            return Math.round(joystick().y * 100);
        }
        whenSwiped () {
            // Started by startHats when a swipe happens; the DIRECTION field is matched there.
            return true;
        }
        lastSwipe () {
            return lastSwipe;
        }
        touchingStage () {
            return fingers.size > 0;
        }
        fingerCount () {
            return fingers.size;
        }
        fingerX ({N}) {
            const f = finger(N);
            return f ? f.x : '';
        }
        fingerY ({N}) {
            const f = finger(N);
            return f ? f.y : '';
        }
        whenTilted ({DIRECTION}) {
            return isTilted(DIRECTION);
        }
        isTilted ({DIRECTION}) {
            return isTilted(DIRECTION);
        }
        tiltX () {
            return tiltX();
        }
        tiltY () {
            return tiltY();
        }
        resetTilt () {
            tiltCentre = tiltReading ? {side: 0, front: tiltReading.front} : null;
        }
        save ({VALUE, NAME}) {
            writeSave(NAME, VALUE);
        }
        load ({NAME}) {
            const value = readSave(NAME);
            return value === null ? '' : value;
        }
        isSaved ({NAME}) {
            return readSave(NAME) !== null;
        }
        deleteSave ({NAME}) {
            deleteSave(NAME);
        }
        setControls ({MODE}) {
            const t = touch();
            if (t) t.setControlsVisible(Scratch.Cast.toString(MODE).toLowerCase() !== 'hide');
        }
        vibrate ({MS}) {
            const ms = clamp(Scratch.Cast.toNumber(MS), 0, 1000);
            try {
                if (navigator.vibrate) navigator.vibrate(ms);
            } catch (e) {
                // vibration not allowed here
            }
        }
        isTouchScreen () {
            return isTouchDevice();
        }
        isPortrait () {
            return isPortrait();
        }
    }

    Scratch.extensions.register(new ScratchProPhone());
}(Scratch));
