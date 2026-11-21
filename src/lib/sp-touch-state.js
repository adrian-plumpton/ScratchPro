// ScratchPro: live touch-control state, shared between the on-screen controls and the Touch blocks.
// Exposed as window.ScratchProTouch so the (unsandboxed) Touch extension can read it.

import {isTouchDevice} from './sp-mobile';

const HIDDEN_KEY = 'sp:touchControlsHidden';

const readHidden = () => {
    try {
        return localStorage.getItem(HIDDEN_KEY) === '1';
    } catch (e) {
        return false;
    }
};

const listeners = new Set();

/** Tell subscribers (the on-screen controls) that visibility changed. */
const emit = () => {
    listeners.forEach(fn => fn());
};

const state = {
    version: 1,
    joystick: {x: 0, y: 0, active: false},
    pressedButtons: new Set(),
    hiddenByUser: readHidden(),
    hiddenByProject: false,
    isTouchDevice: () => isTouchDevice(),

    /**
     * Whether controls are currently allowed to show.
     * @returns {boolean} True unless hidden by the player or the project.
     */
    controlsVisible () {
        return !state.hiddenByUser && !state.hiddenByProject;
    },
    /**
     * Hide or show the controls from project code (Touch blocks). Not remembered.
     * @param {boolean} visible Whether to show them.
     */
    setControlsVisible (visible) {
        state.hiddenByProject = !visible;
        emit();
    },
    /**
     * Hide or show the controls by the player's choice. Remembered on this device.
     * @param {boolean} hidden Whether to hide them.
     */
    setHiddenByUser (hidden) {
        state.hiddenByUser = hidden;
        try {
            localStorage.setItem(HIDDEN_KEY, hidden ? '1' : '0');
        } catch (e) {
            // storage unavailable (private mode); the choice lasts for this page only
        }
        emit();
    },
    setJoystick (x, y, active) {
        state.joystick.x = x;
        state.joystick.y = y;
        state.joystick.active = active;
    },
    reset () {
        state.setJoystick(0, 0, false);
        state.pressedButtons.clear();
        state.hiddenByProject = false;
        emit();
    },
    subscribe (fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }
};

if (typeof window !== 'undefined') {
    window.ScratchProTouch = state;
}

export default state;
