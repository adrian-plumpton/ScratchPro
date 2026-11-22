import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import bindAll from 'lodash.bindall';
import debounce from 'lodash.debounce';
import {connect} from 'react-redux';

import TouchControls from '../components/sp-touch-controls/touch-controls.jsx';
import {getTouchConfig, describeKey, configsEqual} from '../lib/sp-touch-config';
import touchState from '../lib/sp-touch-state';
import {isTouchDevice, setImmersive} from '../lib/sp-mobile';
import {setFullScreen} from '../reducers/mode';

const EMPTY_CONFIG = {joystick: null, buttons: []};

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

const requestBrowserFullscreen = () => {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request) return Promise.reject(new Error('Fullscreen API unavailable'));
    try {
        return Promise.resolve(request.call(el, {navigationUI: 'hide'}));
    } catch (e) {
        return Promise.reject(e);
    }
};

const exitBrowserFullscreen = () => {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit || !fullscreenElement()) return;
    try {
        const result = exit.call(document);
        if (result && result.catch) result.catch(() => {});
    } catch (e) {
        // already exited
    }
};

/**
 * ScratchPro touch layer: on phones and tablets it shows game controls built from the keys the
 * project uses, sends them to the VM as key presses, and makes full screen truly full screen.
 */
class SPTouchControls extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleKey',
            'handleJoystick',
            'handlePlay',
            'handleToggleHidden',
            'handleStateChange',
            'handleVisibilityChange',
            'handleBrowserFullscreenChange',
            'handleProjectLoaded',
            'handlePause',
            'handleResume',
            'handleRestart',
            'handleExit',
            'rescan'
        ]);
        this.isTouch = isTouchDevice();
        this.keyCounts = new Map();
        this.weRequestedFullscreen = false;
        this.debouncedRescan = debounce(this.rescan, 400);
        this.state = {
            config: EMPTY_CONFIG,
            hidden: !touchState.controlsVisible(),
            paused: false
        };
    }
    componentDidMount () {
        if (!this.isTouch) return;
        const vm = this.props.vm;
        vm.on('PROJECT_LOADED', this.handleProjectLoaded);
        vm.on('PROJECT_CHANGED', this.debouncedRescan);
        vm.on('workspaceUpdate', this.debouncedRescan);
        this.unsubscribe = touchState.subscribe(this.handleStateChange);
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
        document.addEventListener('fullscreenchange', this.handleBrowserFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this.handleBrowserFullscreenChange);
        this.rescan();
        this.syncImmersive(false);
    }
    componentDidUpdate (prevProps) {
        if (!this.isTouch) return;
        if (prevProps.isFullScreen !== this.props.isFullScreen || prevProps.isEmbedded !== this.props.isEmbedded) {
            this.syncImmersive(prevProps.isFullScreen);
        }
        // Leaving full screen however it happens never leaves the game frozen.
        if (prevProps.isFullScreen && !this.props.isFullScreen && this.state.paused) this.handleResume();
    }
    componentWillUnmount () {
        if (!this.isTouch) return;
        const vm = this.props.vm;
        vm.removeListener('PROJECT_LOADED', this.handleProjectLoaded);
        vm.removeListener('PROJECT_CHANGED', this.debouncedRescan);
        vm.removeListener('workspaceUpdate', this.debouncedRescan);
        this.debouncedRescan.cancel();
        if (this.unsubscribe) this.unsubscribe();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        document.removeEventListener('fullscreenchange', this.handleBrowserFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this.handleBrowserFullscreenChange);
        this.releaseAllKeys();
        setImmersive(false);
    }
    // Sparkjam: the pause menu (design P4). Pausing stops the frame loop and the project timer,
    // so timers and waits carry on where they left off.
    handlePause () {
        if (this.state.paused) return;
        const runtime = this.props.vm.runtime;
        this.setState({paused: true});
        this.pausedAt = Date.now();
        this.releaseAllKeys();
        runtime.frameLoop.stop();
        if (!runtime.ioDevices.clock._paused) runtime.ioDevices.clock.pause();
        this.setAudio(false);
    }
    handleResume () {
        if (!this.state.paused) return;
        const runtime = this.props.vm.runtime;
        this.setState({paused: false});
        // Push running waits and timers forward by the time spent paused, like TurboWarp's debugger.
        const pausedFor = Date.now() - this.pausedAt;
        for (const thread of runtime.threads) {
            const frame = thread.peekStackFrame && thread.peekStackFrame();
            [
                thread.timer,
                thread.compatibilityStackFrame && thread.compatibilityStackFrame.timer,
                frame && frame.executionContext && frame.executionContext.timer
            ].forEach(timer => {
                if (timer && typeof timer.startTime === 'number') timer.startTime += pausedFor;
            });
        }
        runtime.ioDevices.clock.resume();
        runtime.frameLoop.start();
        this.setAudio(true);
    }
    setAudio (on) {
        try {
            const context = this.props.vm.runtime.audioEngine.audioContext;
            Promise.resolve(on ? context.resume() : context.suspend()).catch(() => {});
        } catch (e) {
            // No audio on this device; nothing to pause.
        }
    }
    handleRestart () {
        this.handleResume();
        this.props.vm.greenFlag();
    }
    handleExit () {
        this.handleResume();
        this.props.onSetFullScreen(false);
    }
    syncImmersive (wasFullScreen) {
        const {isFullScreen, isEmbedded} = this.props;
        setImmersive(isFullScreen || isEmbedded);
        // Embeds manage browser full screen themselves (TWEmbedFullScreenHOC).
        if (isEmbedded) return;
        if (isFullScreen && !wasFullScreen && !fullscreenElement()) {
            // Runs inside the tap that entered full screen, so the browser allows it.
            // iPhone Safari has no element full screen; the edge-to-edge layout still applies there.
            requestBrowserFullscreen()
                .then(() => {
                    this.weRequestedFullscreen = true;
                    this.lockOrientation();
                })
                .catch(() => {});
        } else if (!isFullScreen && wasFullScreen && this.weRequestedFullscreen) {
            this.weRequestedFullscreen = false;
            exitBrowserFullscreen();
        }
    }
    lockOrientation () {
        const orientation = screen.orientation;
        if (!orientation || !orientation.lock) return;
        const {width, height} = this.props.customStageSize;
        orientation.lock(width >= height ? 'landscape' : 'portrait').catch(() => {});
    }
    handleBrowserFullscreenChange () {
        // Leaving browser full screen with the back gesture or Esc also leaves the game view.
        if (!fullscreenElement() && this.weRequestedFullscreen) {
            this.weRequestedFullscreen = false;
            if (this.props.isFullScreen) this.props.onSetFullScreen(false);
        }
    }
    handleProjectLoaded () {
        // A new game starts with controls showing, even if the last one hid them with a Touch block.
        if (touchState.hiddenByProject) touchState.setControlsVisible(true);
        this.rescan();
    }
    rescan () {
        const config = getTouchConfig(this.props.vm);
        if (!configsEqual(config, this.state.config)) {
            this.releaseAllKeys();
            this.setState({config});
        }
    }
    handleStateChange () {
        this.setState({hidden: !touchState.controlsVisible()});
    }
    handleVisibilityChange () {
        if (document.hidden) this.releaseAllKeys();
    }
    postKey (scratchKey, isDown) {
        const {key, keyCode} = describeKey(scratchKey);
        this.props.vm.postIOData('keyboard', {key, keyCode, isDown});
    }
    handleKey (scratchKey, isDown) {
        // Count presses so the stick and a button sharing a key don't release each other.
        const count = this.keyCounts.get(scratchKey) || 0;
        const next = Math.max(0, count + (isDown ? 1 : -1));
        this.keyCounts.set(scratchKey, next);
        if (isDown && count === 0) {
            this.postKey(scratchKey, true);
            touchState.pressedButtons.add(scratchKey);
        } else if (!isDown && count > 0 && next === 0) {
            this.postKey(scratchKey, false);
            touchState.pressedButtons.delete(scratchKey);
        }
    }
    releaseAllKeys () {
        for (const [scratchKey, count] of this.keyCounts) {
            if (count > 0) this.postKey(scratchKey, false);
        }
        this.keyCounts.clear();
        touchState.pressedButtons.clear();
        touchState.setJoystick(0, 0, false);
    }
    handleJoystick (x, y, active) {
        touchState.setJoystick(x, y, active);
    }
    handlePlay () {
        this.props.onSetFullScreen(true);
        this.props.vm.start();
        this.props.vm.greenFlag();
    }
    handleToggleHidden () {
        if (touchState.controlsVisible()) {
            touchState.setHiddenByUser(true);
        } else {
            // The player's choice wins over a project that hid them.
            touchState.setHiddenByUser(false);
            touchState.setControlsVisible(true);
        }
    }
    render () {
        if (!this.isTouch) return null;
        const {isFullScreen, isEmbedded, isPlayerOnly} = this.props;
        const common = {
            config: this.state.config,
            hidden: this.state.hidden,
            onKey: this.handleKey,
            onJoystick: this.handleJoystick,
            onToggleHidden: this.handleToggleHidden
        };
        if (isFullScreen || isEmbedded) {
            const {width, height} = this.props.customStageSize;
            const stageWidth = Math.min(window.innerWidth, window.innerHeight * (width / height));
            return ReactDOM.createPortal(
                <TouchControls
                    layout="overlay"
                    sideSpace={(window.innerWidth - stageWidth) / 2}
                    paused={this.state.paused}
                    onPause={this.handlePause}
                    onResume={this.handleResume}
                    onRestart={this.handleRestart}
                    onExit={isEmbedded ? null : this.handleExit}
                    {...common}
                />,
                document.body
            );
        }
        if (isPlayerOnly && this.props.placement === 'pad') {
            return (
                <TouchControls
                    layout="pad"
                    showPlayButton
                    onPlay={this.handlePlay}
                    {...common}
                />
            );
        }
        return null;
    }
}

SPTouchControls.propTypes = {
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }).isRequired,
    // eslint-disable-next-line react/no-unused-prop-types
    dimensions: PropTypes.arrayOf(PropTypes.number), // re-render on resize/rotate
    isEmbedded: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    onSetFullScreen: PropTypes.func.isRequired,
    placement: PropTypes.oneOf(['pad', 'overlay-only']),
    vm: PropTypes.shape({
        on: PropTypes.func,
        removeListener: PropTypes.func,
        postIOData: PropTypes.func,
        start: PropTypes.func,
        greenFlag: PropTypes.func,
        runtime: PropTypes.object
    }).isRequired
};

SPTouchControls.defaultProps = {
    placement: 'pad'
};

const mapStateToProps = state => ({
    customStageSize: state.scratchGui.customStageSize,
    dimensions: state.scratchGui.tw.dimensions,
    isEmbedded: state.scratchGui.mode.isEmbedded,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onSetFullScreen: isFullScreen => dispatch(setFullScreen(isFullScreen))
});

export default connect(mapStateToProps, mapDispatchToProps)(SPTouchControls);
