import defaultsDeep from 'lodash.defaultsdeep';

import * as accentPurple from './accent/purple';
import * as accentBlue from './accent/blue';
import * as accentRed from './accent/red';
import * as accentRainbow from './accent/rainbow';
import * as accentSparkjam from './accent/sparkjam';

import * as guiLight from './gui/light';
import * as guiDark from './gui/dark';
import * as guiSparkjam from './gui/sparkjam';

import * as blocksThree from './blocks/three';
import * as blocksHighContrast from './blocks/high-contrast';
import * as blocksDark from './blocks/dark';
import * as blocksSparkjam from './blocks/sparkjam';

const ACCENT_PURPLE = 'purple';
const ACCENT_BLUE = 'blue';
const ACCENT_RED = 'red';
const ACCENT_RAINBOW = 'rainbow';
const ACCENT_SPARKJAM = 'sparkjam';
const ACCENT_MAP = {
    [ACCENT_SPARKJAM]: accentSparkjam,
    [ACCENT_PURPLE]: accentPurple,
    [ACCENT_BLUE]: accentBlue,
    [ACCENT_RED]: accentRed,
    [ACCENT_RAINBOW]: accentRainbow
};
// Sparkjam: the Sparkjam look is the default; Scratch's and TurboWarp's are still in Settings.
const ACCENT_DEFAULT = ACCENT_SPARKJAM;

const GUI_LIGHT = 'light';
const GUI_DARK = 'dark';
const GUI_SPARKJAM = 'sparkjam';
const GUI_MAP = {
    [GUI_SPARKJAM]: guiSparkjam,
    [GUI_LIGHT]: guiLight,
    [GUI_DARK]: guiDark
};
const GUI_DEFAULT = GUI_SPARKJAM;

const BLOCKS_THREE = 'three';
const BLOCKS_DARK = 'dark';
const BLOCKS_HIGH_CONTRAST = 'high-contrast';
const BLOCKS_CUSTOM = 'custom';
const BLOCKS_SPARKJAM = 'sparkjam';
const BLOCKS_DEFAULT = BLOCKS_SPARKJAM;
const defaultBlockColors = blocksThree.blockColors;
const BLOCKS_MAP = {
    [BLOCKS_SPARKJAM]: {
        blocksMediaFolder: 'blocks-media/default',
        colors: defaultsDeep({}, blocksSparkjam.blockColors, defaultBlockColors),
        extensions: blocksSparkjam.extensions,
        customExtensionColors: blocksSparkjam.customExtensionColors,
        // The stage's own blocks stay readable on the light stage panel either way.
        useForStage: true
    },
    [BLOCKS_THREE]: {
        blocksMediaFolder: 'blocks-media/default',
        colors: blocksThree.blockColors,
        extensions: blocksThree.extensions,
        customExtensionColors: {},
        useForStage: true
    },
    [BLOCKS_HIGH_CONTRAST]: {
        blocksMediaFolder: 'blocks-media/high-contrast',
        colors: defaultsDeep({}, blocksHighContrast.blockColors, defaultBlockColors),
        extensions: blocksHighContrast.extensions,
        customExtensionColors: blocksHighContrast.customExtensionColors,
        useForStage: true
    },
    [BLOCKS_DARK]: {
        blocksMediaFolder: 'blocks-media/default',
        colors: defaultsDeep({}, blocksDark.blockColors, defaultBlockColors),
        extensions: blocksDark.extensions,
        customExtensionColors: blocksDark.customExtensionColors,
        useForStage: false
    },
    [BLOCKS_CUSTOM]: {
        // to be filled by editor-theme3 addon
        blocksMediaFolder: 'blocks-media/default',
        colors: blocksThree.blockColors,
        extensions: {},
        customExtensionColors: {},
        useForStage: false
    }
};

let themeObjectsCreated = 0;

class Theme {
    constructor (accent, gui, blocks) {
        // do not modify these directly
        /** @readonly */
        this.id = ++themeObjectsCreated;
        /** @readonly */
        this.accent = Object.prototype.hasOwnProperty.call(ACCENT_MAP, accent) ? accent : ACCENT_DEFAULT;
        /** @readonly */
        this.gui = Object.prototype.hasOwnProperty.call(GUI_MAP, gui) ? gui : GUI_DEFAULT;
        /** @readonly */
        this.blocks = Object.prototype.hasOwnProperty.call(BLOCKS_MAP, blocks) ? blocks : BLOCKS_DEFAULT;
    }

    static sparkjam = new Theme(ACCENT_SPARKJAM, GUI_SPARKJAM, BLOCKS_SPARKJAM);
    static light = new Theme(ACCENT_BLUE, GUI_LIGHT, BLOCKS_THREE);
    static dark = new Theme(ACCENT_BLUE, GUI_DARK, BLOCKS_THREE);
    static highContrast = new Theme(ACCENT_BLUE, GUI_LIGHT, BLOCKS_HIGH_CONTRAST);

    set (what, to) {
        if (what === 'accent') {
            return new Theme(to, this.gui, this.blocks);
        } else if (what === 'gui') {
            return new Theme(this.accent, to, this.blocks);
        } else if (what === 'blocks') {
            return new Theme(this.accent, this.gui, to);
        }
        throw new Error(`Unknown theme property: ${what}`);
    }

    getBlocksMediaFolder () {
        return BLOCKS_MAP[this.blocks].blocksMediaFolder;
    }

    getGuiColors () {
        return defaultsDeep(
            {},
            ACCENT_MAP[this.accent].guiColors,
            GUI_MAP[this.gui].guiColors,
            guiLight.guiColors
        );
    }

    getBlockColors () {
        return defaultsDeep(
            {},
            ACCENT_MAP[this.accent].blockColors,
            GUI_MAP[this.gui].blockColors,
            BLOCKS_MAP[this.blocks].colors
        );
    }

    getExtensions () {
        return BLOCKS_MAP[this.blocks].extensions;
    }

    isDark () {
        return this.getGuiColors()['color-scheme'] === 'dark';
    }

    getStageBlockColors () {
        if (BLOCKS_MAP[this.blocks].useForStage) {
            return this.getBlockColors();
        }
        return Theme.light.getBlockColors();
    }

    getCustomExtensionColors () {
        return BLOCKS_MAP[this.blocks].customExtensionColors;
    }
}

export {
    Theme,
    defaultBlockColors,

    ACCENT_RED,
    ACCENT_PURPLE,
    ACCENT_BLUE,
    ACCENT_RAINBOW,
    ACCENT_SPARKJAM,
    ACCENT_MAP,

    GUI_LIGHT,
    GUI_DARK,
    GUI_SPARKJAM,
    GUI_MAP,

    BLOCKS_THREE,
    BLOCKS_DARK,
    BLOCKS_HIGH_CONTRAST,
    BLOCKS_CUSTOM,
    BLOCKS_SPARKJAM,
    BLOCKS_MAP
};
