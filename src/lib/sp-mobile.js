// ScratchPro: shared helpers for the phone and tablet experience.

const params = typeof URLSearchParams === 'undefined' ? null : new URLSearchParams(location.search);

/**
 * ?touch=1 forces touch mode on (useful for testing on a desktop), ?touch=0 forces it off.
 * @returns {boolean|null} The forced value, or null when not forced.
 */
const forcedTouch = () => {
    if (!params || !params.has('touch')) return null;
    return params.get('touch') !== '0';
};

/**
 * True on phones and tablets, where the main input is a finger.
 * @returns {boolean} Whether to use the touch-first experience.
 */
const isTouchDevice = () => {
    const forced = forcedTouch();
    if (forced !== null) return forced;
    if (typeof window === 'undefined') return false;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
    return navigator.maxTouchPoints > 0 && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
};

/** Horizontal space kept free beside the player stage on small screens, in px (both sides together). */
const PLAYER_GUTTER = 16;

/**
 * Widest the player stage may be so the page never scrolls sideways.
 * @returns {number} Max stage width in CSS px, excluding the 1px border on each side.
 */
const getPlayerMaxStageWidth = () => Math.max(160, window.innerWidth - PLAYER_GUTTER - 2);

/**
 * Phones get the compact editor (one pane at a time). Decided from the screen, not the window,
 * because tablets change the viewport width to fit the full editor.
 * @returns {boolean} True on phone-sized touch screens.
 */
const isCompactEditor = () => {
    if (!isTouchDevice() || typeof screen === 'undefined') return false;
    return Math.min(screen.width, screen.height) < 500;
};

/** Height of the compact editor's bottom bar, in px (plus the safe area). */
const COMPACT_NAV_HEIGHT = 58;

/**
 * Widest the stage may be in the compact editor's Stage view, leaving room for its header and sprites.
 * @param {{width: number, height: number}} stageSize The project's stage size.
 * @returns {number} Max stage width in CSS px.
 */
const getCompactMaxStageWidth = stageSize => {
    const byWidth = window.innerWidth - PLAYER_GUTTER - 2;
    // keep about a third of the height for the sprite list (menu 48 + stage header 44 + nav)
    const byHeight = (window.innerHeight - 48 - 44 - COMPACT_NAV_HEIGHT - 150) * (stageSize.width / stageSize.height);
    return Math.max(160, Math.min(byWidth, Math.max(byHeight, 240)));
};

const DEVICE_VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';
const EDITOR_MIN_WIDTH = 1024;

/**
 * Width of the screen in CSS px in the current orientation (unaffected by the viewport tag).
 * @returns {number} Screen width.
 */
const currentScreenWidth = () => {
    const landscape = window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
    const long = Math.max(screen.width, screen.height);
    const short = Math.min(screen.width, screen.height);
    return landscape ? long : short;
};

/**
 * The full editor needs 1024 CSS px; tablets narrower than that zoom it out to fit instead of cutting it off.
 * @param {boolean} fullEditorOnTablet True to scale the 1024px editor to fit a tablet.
 */
const setViewport = fullEditorOnTablet => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    let content = DEVICE_VIEWPORT;
    const width = currentScreenWidth();
    if (fullEditorOnTablet && width < EDITOR_MIN_WIDTH) {
        const scale = Math.floor(width / EDITOR_MIN_WIDTH * 1000) / 1000;
        content = `width=${EDITOR_MIN_WIDTH}, initial-scale=${scale}, viewport-fit=cover`;
    }
    if (meta.getAttribute('content') !== content) meta.setAttribute('content', content);
};

const IMMERSIVE_CLASS = 'sp-immersive';

// Full-screen play on touch devices: edge to edge, black letterbox, floating translucent controls.
// Class names are CSS-module hashed, so match on their stable prefixes (as addons do).
const IMMERSIVE_CSS = `
body.${IMMERSIVE_CLASS} { overscroll-behavior: none; overflow: hidden; }
body.${IMMERSIVE_CLASS} [class*="stage-wrapper_full-screen"] {
    top: 0 !important; padding: 0 !important; background: #000 !important;
    justify-content: center;
}
body.${IMMERSIVE_CLASS} [class*="stage-wrapper_full-screen"] [class*="stage_full-screen"],
body.${IMMERSIVE_CLASS} [class*="stage-wrapper_full-screen"] [class*="stage_green-flag-overlay-wrapper"] {
    border: 0 !important; border-radius: 0 !important;
}
body.${IMMERSIVE_CLASS} [class*="stage_stage-overlays_"][class*="stage_full-screen_"] { top: 0; left: 0; }
body.${IMMERSIVE_CLASS} [class*="stage-header_stage-header-wrapper-overlay"] {
    background: transparent !important; pointer-events: none;
}
body.${IMMERSIVE_CLASS} [class*="stage-header_stage-menu-wrapper"] {
    width: 100% !important; box-sizing: border-box; height: auto;
    padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
        0 max(10px, env(safe-area-inset-left));
}
body.${IMMERSIVE_CLASS} [class*="stage-header_stage-menu-wrapper"] > * {
    pointer-events: auto;
    background: rgba(20, 20, 30, 0.45); border-radius: 999px; padding: 4px 6px;
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
}
body.${IMMERSIVE_CLASS} [class*="stage-header_fullscreen-buttons-row"],
body.${IMMERSIVE_CLASS} [class*="stage-header_unselect-wrapper"] {
    background: transparent !important; padding: 0 !important; -webkit-backdrop-filter: none; backdrop-filter: none;
}
body.${IMMERSIVE_CLASS} [class*="stage-header_stage-button_"] {
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    background: rgba(255, 255, 255, 0.92); border: 0; border-radius: 999px; width: 2.5rem; height: 2.5rem;
    padding: 0.6rem;
}
[class*="stage_stage_"] canvas { touch-action: none; }

/* Compact editor (phones): one pane at a time, switched with the bottom bar */
body.sp-compact-editor [class*="gui_page-wrapper"] {
    height: calc(100% - ${COMPACT_NAV_HEIGHT}px - env(safe-area-inset-bottom)) !important;
    min-width: 0 !important; /* the GUI sets an inline 1024px minimum */
}
body.sp-compact-editor [class*="gui_editor-wrapper"] {
    flex-basis: 100% !important; flex-shrink: 1 !important; min-width: 0 !important;
}
body.sp-compact-editor [class*="gui_stage-and-target-wrapper"] {
    flex: 1 1 100% !important; min-width: 0 !important; overflow-y: auto;
}
body.sp-compact-editor.sp-view-code [class*="gui_stage-and-target-wrapper"],
body.sp-compact-editor.sp-view-stage [class*="gui_editor-wrapper"] { display: none !important; }
/* A full-screen game lives in the stage column, so keep that column on while playing from Code view */
body.sp-compact-editor.sp-immersive [class*="gui_stage-and-target-wrapper"] { display: flex !important; }
body.sp-compact-editor [class*="stage-header_stage-size-toggle-group"] { display: none !important; }
body.sp-compact-editor [class*="gui_target-wrapper"] { padding-bottom: 14px; }
body.sp-compact-editor [class*="stage-header_stage-header-wrapper_"] { min-width: 0 !important; }
body.sp-compact-editor [class*="menu-bar_menu-bar_"] { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
body.sp-compact-editor [class*="menu-bar_menu-bar_"]::-webkit-scrollbar { display: none; }
body.sp-compact-editor [class*="menu-bar_feedback-link"] { display: none; }
`;

let styleInjected = false;
const injectMobileStyles = () => {
    if (styleInjected || typeof document === 'undefined') return;
    styleInjected = true;
    const style = document.createElement('style');
    style.dataset.scratchpro = 'mobile';
    style.textContent = IMMERSIVE_CSS;
    document.head.appendChild(style);
};

/**
 * Turn the edge-to-edge game layout on or off.
 * @param {boolean} on Whether immersive mode is active.
 */
const setImmersive = on => {
    injectMobileStyles();
    document.body.classList.toggle(IMMERSIVE_CLASS, on);
};

const isImmersive = () => typeof document !== 'undefined' && document.body.classList.contains(IMMERSIVE_CLASS);

export {
    COMPACT_NAV_HEIGHT,
    isCompactEditor,
    getCompactMaxStageWidth,
    setViewport,
    forcedTouch,
    isTouchDevice,
    isImmersive,
    setImmersive,
    injectMobileStyles,
    getPlayerMaxStageWidth,
    PLAYER_GUTTER
};
