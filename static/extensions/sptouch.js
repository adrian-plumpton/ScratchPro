// ScratchPro Touch: blocks for games played on phones and tablets.
// Runs unsandboxed (ScratchPro trusts its own /extensions/sp*.js) so it can read the on-screen
// joystick state that ScratchPro publishes on window.ScratchProTouch.
(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error('ScratchPro Touch must run unsandboxed');
    }

    const vm = Scratch.vm;
    const runtime = vm.runtime;

    const touch = () => window.ScratchProTouch || null;

    // Fingers (and the mouse, for testing on a computer) currently pressed on the stage, oldest first.
    const fingers = new Map();

    const getCanvas = () => runtime.renderer && runtime.renderer.canvas;

    const toStage = (clientX, clientY) => {
        const canvas = getCanvas();
        const rect = canvas.getBoundingClientRect();
        const w = runtime.stageWidth;
        const h = runtime.stageHeight;
        const x = ((clientX - rect.left) / rect.width * w) - (w / 2);
        const y = (h / 2) - ((clientY - rect.top) / rect.height * h);
        return {
            x: Math.round(Math.max(-w / 2, Math.min(w / 2, x))),
            y: Math.round(Math.max(-h / 2, Math.min(h / 2, y)))
        };
    };

    const onDown = e => {
        if (e.target !== getCanvas()) return;
        fingers.set(e.pointerId, toStage(e.clientX, e.clientY));
    };
    const onMove = e => {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, toStage(e.clientX, e.clientY));
    };
    const onUp = e => {
        fingers.delete(e.pointerId);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    window.addEventListener('blur', () => fingers.clear());

    const finger = n => Array.from(fingers.values())[Math.floor(Scratch.Cast.toNumber(n)) - 1] || null;

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

    const isTouchDevice = () => {
        const t = touch();
        if (t && t.isTouchDevice) return !!t.isTouchDevice();
        return window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
    };

    const ICON = 'data:image/svg+xml;base64,' + btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' +
        '<circle cx="20" cy="20" r="19" fill="#4f46e5" stroke="#3730a3" stroke-width="2"/>' +
        '<rect x="7" y="13" width="26" height="15" rx="7.5" fill="#fff"/>' +
        '<path d="M13 17v3h-3v2h3v3h2v-3h3v-2h-3v-3z" fill="#4f46e5"/>' +
        '<circle cx="25" cy="19" r="2" fill="#ef4444"/><circle cx="28.5" cy="23" r="2" fill="#3b82f6"/>' +
        '</svg>'
    );

    class ScratchProTouch {
        getInfo () {
            return {
                id: 'sptouch',
                name: 'Touch',
                color1: '#4f46e5',
                color2: '#4338ca',
                color3: '#3730a3',
                menuIconURI: ICON,
                docsURI: 'https://github.com/adrian-plumpton/ScratchPro#touch-blocks',
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
                    }
                ],
                menus: {
                    showHide: {
                        acceptReporters: true,
                        items: ['show', 'hide']
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
        setControls ({MODE}) {
            const t = touch();
            if (t) t.setControlsVisible(Scratch.Cast.toString(MODE).toLowerCase() !== 'hide');
        }
        vibrate ({MS}) {
            const ms = Math.max(0, Math.min(1000, Scratch.Cast.toNumber(MS)));
            try {
                if (navigator.vibrate) navigator.vibrate(ms);
            } catch (e) {
                // vibration not allowed here
            }
        }
        isTouchScreen () {
            return isTouchDevice();
        }
    }

    Scratch.extensions.register(new ScratchProTouch());
}(Scratch));
