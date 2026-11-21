import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import {connect} from 'react-redux';

import SettingsStore from '../addons/settings-store-singleton';
import LazyScratchBlocks from '../lib/tw-lazy-scratch-blocks';
import {isTouchDevice, isCompactEditor, setViewport} from '../lib/sp-mobile';
import {setFullScreen} from '../reducers/mode';
import styles from '../components/sp-touch-controls/mobile-editor.css';

const VIEW_CODE = 'code';
const VIEW_STAGE = 'stage';

const nudgeLayout = () => {
    // Blockly and the stage measure themselves on resize.
    window.dispatchEvent(new Event('resize'));
};

/**
 * Turn on the auto-hiding block palette in "tap a category" mode, unless the person chose otherwise.
 * On a phone the palette would otherwise leave almost no room for scripts.
 */
const enableCompactPalette = () => {
    try {
        const storage = SettingsStore.getAddonStorage('hide-flyout');
        if (Object.prototype.hasOwnProperty.call(storage, 'enabled')) return;
        SettingsStore.setAddonSetting('hide-flyout', 'toggle', 'category');
        SettingsStore.setAddonEnabled('hide-flyout', true);
    } catch (e) {
        // addon unavailable; the editor still works with the full palette
    }
};

/**
 * On phones the hidden palette still reserves its space in Blockly's layout, so a sprite's scripts open
 * far to the right. Scroll them to start just beside the category column.
 */
const alignScriptsToLeft = () => {
    if (!LazyScratchBlocks.isLoaded()) return;
    try {
        const workspace = LazyScratchBlocks.get().getMainWorkspace();
        if (!workspace || !workspace.scrollbar || !workspace.getTopBlocks(false).length) return;
        const metrics = workspace.getMetrics();
        const bounds = workspace.getBlocksBoundingBox();
        const toolbox = document.querySelector('.blocklyToolboxDiv');
        const toolboxRight = toolbox ? toolbox.getBoundingClientRect().right : 60;
        const left = toolboxRight + 12 - metrics.absoluteLeft;
        workspace.scrollbar.set(
            (bounds.x * workspace.scale) - left - metrics.contentLeft,
            (bounds.y * workspace.scale) - 12 - metrics.contentTop
        );
    } catch (e) {
        // layout nicety only
    }
};

/**
 * ScratchPro editor on phones and tablets.
 * Tablets: the full editor is scaled to fit the screen.
 * Phones: one pane at a time (Code or Stage), switched with a bottom bar that also has a Play button.
 */
class SPMobileEditor extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleCode', 'handleStage', 'handlePlay', 'handleWorkspaceUpdate']);
        this.isTouch = isTouchDevice();
        this.isCompact = isCompactEditor();
        this.state = {view: VIEW_CODE};
        // Apply the phone layout before the blocks workspace mounts, so it is laid out at phone width
        // (React runs every constructor before any componentDidMount).
        this.sync(false);
        this.handleOrientation = () => this.sync();
    }
    componentDidMount () {
        if (this.isTouch) window.addEventListener('orientationchange', this.handleOrientation);
        if (this.isCompact) this.props.vm.on('workspaceUpdate', this.handleWorkspaceUpdate);
        this.sync();
    }
    componentDidUpdate (prevProps, prevState) {
        if (prevProps.isPlayerOnly !== this.props.isPlayerOnly ||
            prevProps.isFullScreen !== this.props.isFullScreen ||
            prevState.view !== this.state.view) {
            this.sync();
        }
    }
    componentWillUnmount () {
        window.removeEventListener('orientationchange', this.handleOrientation);
        this.props.vm.removeListener('workspaceUpdate', this.handleWorkspaceUpdate);
        clearTimeout(this.alignTimeout);
        document.body.classList.remove('sp-compact-editor', 'sp-view-code', 'sp-view-stage');
    }
    isEditing () {
        return !this.props.isPlayerOnly && !this.props.isEmbedded;
    }
    sync (nudge = true) {
        if (!this.isTouch) return;
        const editing = this.isEditing();
        setViewport(editing && !this.isCompact);
        const compact = editing && this.isCompact;
        const view = this.state ? this.state.view : VIEW_CODE;
        const body = document.body.classList;
        body.toggle('sp-compact-editor', compact);
        body.toggle('sp-view-code', compact && view === VIEW_CODE);
        body.toggle('sp-view-stage', compact && view === VIEW_STAGE);
        if (compact) enableCompactPalette();
        if (nudge) nudgeLayout();
    }
    handleWorkspaceUpdate () {
        // Blockly renders the new sprite's scripts after this event; align once it has.
        clearTimeout(this.alignTimeout);
        this.alignTimeout = setTimeout(() => {
            if (this.isEditing() && this.state.view === VIEW_CODE) alignScriptsToLeft();
        }, 120);
    }
    handleCode () {
        this.setState({view: VIEW_CODE}, this.handleWorkspaceUpdate);
    }
    handleStage () {
        this.setState({view: VIEW_STAGE});
    }
    handlePlay () {
        this.props.onSetFullScreen(true);
        this.props.vm.start();
        this.props.vm.greenFlag();
    }
    render () {
        if (!this.isTouch || !this.isCompact || !this.isEditing() || this.props.isFullScreen) return null;
        const {view} = this.state;
        return ReactDOM.createPortal(
            <nav
                className={styles.nav}
                aria-label="Editor view"
            >
                <button
                    className={view === VIEW_CODE ? styles.selected : styles.tab}
                    onClick={this.handleCode}
                    aria-pressed={view === VIEW_CODE}
                    type="button"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            // eslint-disable-next-line max-len
                            d="M4 5h6l1.5 1.5H14L15.5 5H20a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4.5L14 12.5h-2.5L10 11H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 8h9l1.5 1.5H17L18.5 13H20a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"
                        />
                    </svg>
                    {'Code'}
                </button>
                <button
                    className={styles.play}
                    onClick={this.handlePlay}
                    type="button"
                    aria-label="Play full screen"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"
                        />
                    </svg>
                </button>
                <button
                    className={view === VIEW_STAGE ? styles.selected : styles.tab}
                    onClick={this.handleStage}
                    aria-pressed={view === VIEW_STAGE}
                    type="button"
                >
                    <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            // eslint-disable-next-line max-len
                            d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6v2h3v2H7v-2h3v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v9h16V6H4z"
                        />
                    </svg>
                    {'Stage & sprites'}
                </button>
            </nav>,
            document.body
        );
    }
}

SPMobileEditor.propTypes = {
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    onSetFullScreen: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        on: PropTypes.func,
        removeListener: PropTypes.func,
        start: PropTypes.func,
        greenFlag: PropTypes.func
    }).isRequired
};

const mapStateToProps = state => ({
    isEmbedded: state.scratchGui.mode.isEmbedded,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onSetFullScreen: isFullScreen => dispatch(setFullScreen(isFullScreen))
});

export default connect(mapStateToProps, mapDispatchToProps)(SPMobileEditor);
