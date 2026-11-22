/* eslint-disable react/no-multi-comp */
// Joystick, buttons and the controls layout are small and only used together, so they share a file.
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import bindAll from 'lodash.bindall';

import styles from './touch-controls.css';

const DEAD_ZONE = 0.35;

const vibrate = ms => {
    try {
        if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {
        // not allowed (eg. iframe without user activation); haptics are optional
    }
};

/**
 * A virtual joystick. Reports a normalised position (-1..1, y up) and presses
 * direction keys once it leaves the dead zone, so 8-way movement works.
 */
class Joystick extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleDown', 'handleMove', 'handleUp', 'setBase', 'setKnob']);
        this.pointerId = null;
        this.pressed = {up: false, down: false, left: false, right: false};
    }
    componentWillUnmount () {
        this.release();
    }
    setBase (el) {
        this.base = el;
    }
    setKnob (el) {
        this.knob = el;
    }
    handleDown (e) {
        if (this.pointerId !== null) return;
        e.preventDefault();
        this.pointerId = e.pointerId;
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
            // capture can fail for synthetic events; tracking still works
        }
        if (this.base) this.base.classList.add(styles.active);
        vibrate(8);
        this.update(e);
    }
    handleMove (e) {
        if (e.pointerId !== this.pointerId) return;
        e.preventDefault();
        this.update(e);
    }
    handleUp (e) {
        if (e.pointerId !== this.pointerId) return;
        this.release();
    }
    update (e) {
        const rect = this.base.getBoundingClientRect();
        const radius = rect.width / 2;
        const travel = radius * 0.62;
        let dx = e.clientX - (rect.left + radius);
        let dy = e.clientY - (rect.top + radius);
        const dist = Math.hypot(dx, dy);
        if (dist > travel) {
            dx = dx / dist * travel;
            dy = dy / dist * travel;
        }
        if (this.knob) this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const x = dx / travel;
        const y = -dy / travel;
        this.props.onMove(x, y, true);
        this.setDirections({
            up: y > DEAD_ZONE,
            down: y < -DEAD_ZONE,
            left: x < -DEAD_ZONE,
            right: x > DEAD_ZONE
        });
    }
    setDirections (next) {
        for (const dir of Object.keys(next)) {
            if (next[dir] !== this.pressed[dir]) {
                this.pressed[dir] = next[dir];
                if (this.props.keys) this.props.onKey(this.props.keys[dir], next[dir]);
            }
        }
    }
    release () {
        this.pointerId = null;
        if (this.knob) this.knob.style.transform = '';
        if (this.base) this.base.classList.remove(styles.active);
        this.setDirections({up: false, down: false, left: false, right: false});
        this.props.onMove(0, 0, false);
    }
    render () {
        return (
            <div
                className={styles.joystickZone}
                onPointerDown={this.handleDown}
                onPointerMove={this.handleMove}
                onPointerUp={this.handleUp}
                onPointerCancel={this.handleUp}
                onLostPointerCapture={this.handleUp}
                role="application"
                aria-label="Joystick"
            >
                <div
                    className={styles.joystickBase}
                    ref={this.setBase}
                >
                    <span className={classNames(styles.arrow, styles.arrowUp)} />
                    <span className={classNames(styles.arrow, styles.arrowDown)} />
                    <span className={classNames(styles.arrow, styles.arrowLeft)} />
                    <span className={classNames(styles.arrow, styles.arrowRight)} />
                    <div
                        className={styles.joystickKnob}
                        ref={this.setKnob}
                    />
                </div>
            </div>
        );
    }
}

Joystick.propTypes = {
    keys: PropTypes.shape({
        up: PropTypes.string,
        down: PropTypes.string,
        left: PropTypes.string,
        right: PropTypes.string
    }),
    onKey: PropTypes.func.isRequired,
    onMove: PropTypes.func.isRequired
};

/** A round action button that holds its key down while touched. */
class ActionButton extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleDown', 'handleUp']);
        this.pointers = new Set();
    }
    componentWillUnmount () {
        if (this.pointers.size) this.props.onKey(this.props.button.scratchKey, false);
    }
    handleDown (e) {
        e.preventDefault();
        try {
            e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
            // see Joystick.handleDown
        }
        const wasDown = this.pointers.size > 0;
        this.pointers.add(e.pointerId);
        if (!wasDown) {
            e.currentTarget.classList.add(styles.pressed);
            vibrate(10);
            this.props.onKey(this.props.button.scratchKey, true);
        }
    }
    handleUp (e) {
        if (!this.pointers.delete(e.pointerId) || this.pointers.size) return;
        e.currentTarget.classList.remove(styles.pressed);
        this.props.onKey(this.props.button.scratchKey, false);
    }
    render () {
        const {button, size} = this.props;
        return (
            <button
                className={classNames(styles.actionButton, {[styles.longLabel]: button.label.length > 2})}
                style={{'--sp-button-color': button.color, 'width': size, 'height': size}}
                onPointerDown={this.handleDown}
                onPointerUp={this.handleUp}
                onPointerCancel={this.handleUp}
                onLostPointerCapture={this.handleUp}
                aria-label={`Key ${button.label}`}
                type="button"
            >
                {button.label}
            </button>
        );
    }
}

ActionButton.propTypes = {
    button: PropTypes.shape({
        scratchKey: PropTypes.string,
        label: PropTypes.string,
        color: PropTypes.string
    }).isRequired,
    size: PropTypes.number.isRequired,
    onKey: PropTypes.func.isRequired
};

const preventDefault = e => e.preventDefault();

/**
 * On-screen game controls.
 * "overlay" floats over a full-screen game; "pad" sits under the stage like a handheld console.
 * @param {object} props Component props.
 * @returns {React.ReactElement} The controls.
 */
const GAP = 12;

/**
 * Pick button size and columns. Overlay buttons try to fit in the margin beside the game.
 * @param {number} count Number of buttons.
 * @param {string} layout "overlay" or "pad".
 * @param {number} sideSpace Free px beside the stage on each side (overlay only).
 * @returns {{size: number, columns: number}} Layout for the button cluster.
 */
const buttonLayout = (count, layout, sideSpace) => {
    if (layout === 'pad') {
        return {size: count > 2 ? 58 : 68, columns: count > 2 ? 2 : Math.max(count, 1)};
    }
    let size = count > 4 ? 60 : (count > 2 ? 66 : 76);
    let columns = count > 2 ? 2 : Math.max(count, 1);
    const fits = cols => (cols * size) + ((cols - 1) * GAP) + 20 <= sideSpace;
    // Not enough room beside the game for a row: stack them so they stay off the play area.
    if (columns > 1 && !fits(columns) && sideSpace >= size + 20) columns = 1;
    if (columns === 1 && count > 1) {
        const maxHeight = window.innerHeight - 90;
        while (size > 48 && (count * size) + ((count - 1) * GAP) > maxHeight) size -= 4;
    }
    return {size, columns};
};

const ButtonCluster = ({buttons, layout, sideSpace, onKey}) => {
    const {size, columns} = buttonLayout(buttons.length, layout, sideSpace);
    return (
        <div
            className={styles.buttonGrid}
            style={{width: (columns * size) + ((columns - 1) * GAP)}}
        >
            {buttons.map(button => (
                <ActionButton
                    key={button.scratchKey}
                    button={button}
                    size={size}
                    onKey={onKey}
                />
            ))}
        </div>
    );
};

ButtonCluster.propTypes = {
    buttons: PropTypes.arrayOf(PropTypes.object).isRequired,
    layout: PropTypes.string.isRequired,
    sideSpace: PropTypes.number,
    onKey: PropTypes.func.isRequired
};

const ToggleIcon = ({hidden}) => (
    <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-hidden="true"
    >
        <path
            fill="currentColor"
            // eslint-disable-next-line max-len
            d="M7 6h10a5 5 0 0 1 5 5v2a5 5 0 0 1-8.5 3.5h-3A5 5 0 0 1 2 13v-2a5 5 0 0 1 5-5zm-1 3v2H4v2h2v2h2v-2h2v-2H8V9H6zm10.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2.5 2.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"
        />
        {hidden && (
            <path
                stroke="currentColor"
                strokeWidth="2"
                d="M3 3l18 18"
            />
        )}
    </svg>
);

ToggleIcon.propTypes = {
    hidden: PropTypes.bool
};

/**
 * On-screen game controls.
 * "overlay" floats over a full-screen game; "pad" sits under the stage like a handheld console.
 * @param {object} props Component props.
 * @returns {React.ReactElement} The controls.
 */
const TouchControls = props => {
    const {config, layout, showPlayButton, sideSpace, onKey, onJoystick, onPlay, onToggleHidden, hidden,
        paused, onPause, onResume, onRestart, onExit} = props;
    const hasControls = !!config.joystick || config.buttons.length > 0;
    const showControls = hasControls && !hidden;
    const toggleLabel = hidden ? 'Show touch controls' : 'Hide touch controls';
    // Sparkjam: with its own exit and pause buttons, the overlay replaces TurboWarp's stage header.
    const ownHeader = layout === 'overlay' && !!(onExit || onPause);
    React.useEffect(() => {
        document.body.classList.toggle('sj-own-header', ownHeader);
        return () => document.body.classList.remove('sj-own-header');
    }, [ownHeader]);

    const joystick = config.joystick ? (
        <Joystick
            keys={config.joystick}
            onKey={onKey}
            onMove={onJoystick}
        />
    ) : null;
    const buttons = config.buttons.length ? (
        <ButtonCluster
            buttons={config.buttons}
            layout={layout}
            sideSpace={sideSpace}
            onKey={onKey}
        />
    ) : null;

    if (layout === 'pad') {
        return (
            <div
                className={classNames(styles.root, styles.pad)}
                onContextMenu={preventDefault}
            >
                {showControls && (
                    <div className={styles.padControls}>
                        <div className={styles.left}>{joystick}</div>
                        <div className={styles.right}>{buttons}</div>
                    </div>
                )}
                <div className={styles.padActions}>
                    {showPlayButton && (
                        <button
                            className={styles.playButton}
                            onClick={onPlay}
                            type="button"
                        >
                            <span
                                className={styles.playIcon}
                                aria-hidden="true"
                            />
                            {'Play full screen'}
                        </button>
                    )}
                    {hasControls && (
                        <button
                            className={styles.toggleButton}
                            onClick={onToggleHidden}
                            type="button"
                            aria-label={toggleLabel}
                        >
                            <ToggleIcon hidden={!hidden} />
                            {hidden ? 'Show controls' : 'Hide controls'}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            className={classNames(styles.root, styles.overlay)}
            onContextMenu={preventDefault}
        >
            {/* Sparkjam: exit and pause stay small in the top corners (design P4). */}
            {onExit || onPause ? (
                <div className={styles.topBar}>
                    {onExit ? (
                        <button
                            className={styles.topButton}
                            onClick={onExit}
                            type="button"
                            aria-label="Exit full screen"
                            title="Exit full screen"
                        >{'✕'}</button>
                    ) : null}
                    {onPause ? (
                        <button
                            className={classNames(styles.topButton, styles.pauseButton)}
                            onClick={onPause}
                            type="button"
                            aria-label="Pause"
                            title="Pause"
                        >{'❙❙'}</button>
                    ) : null}
                </div>
            ) : null}
            {paused ? (
                <div
                    className={styles.pauseScreen}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Paused"
                >
                    <div className={styles.pauseBox}>
                        <span className={styles.pauseWho}>{'PAUSED'}</span>
                        <button
                            className={styles.pauseOption}
                            onClick={onResume}
                            type="button"
                            autoFocus
                        >{'▶ RESUME'}</button>
                        <button
                            className={styles.pauseOption}
                            onClick={onRestart}
                            type="button"
                        >{'RESTART'}</button>
                        {hasControls ? (
                            <button
                                className={styles.pauseOption}
                                onClick={onToggleHidden}
                                type="button"
                            >{hidden ? 'SHOW CONTROLS' : 'HIDE CONTROLS'}</button>
                        ) : null}
                        {onExit ? (
                            <button
                                className={styles.pauseOption}
                                onClick={onExit}
                                type="button"
                            >{'EXIT FULL SCREEN'}</button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {!paused && showControls && joystick && <div className={styles.left}>{joystick}</div>}
            {!paused && showControls && buttons && <div className={styles.right}>{buttons}</div>}
            {!paused && hasControls && (
                <button
                    className={styles.overlayToggle}
                    onClick={onToggleHidden}
                    type="button"
                    aria-label={toggleLabel}
                    title={toggleLabel}
                >
                    <ToggleIcon hidden={hidden} />
                </button>
            )}
        </div>
    );
};

TouchControls.propTypes = {
    config: PropTypes.shape({
        joystick: PropTypes.object,
        buttons: PropTypes.arrayOf(PropTypes.object)
    }).isRequired,
    hidden: PropTypes.bool,
    layout: PropTypes.oneOf(['overlay', 'pad']).isRequired,
    showPlayButton: PropTypes.bool,
    sideSpace: PropTypes.number,
    onJoystick: PropTypes.func.isRequired,
    onKey: PropTypes.func.isRequired,
    onPlay: PropTypes.func,
    onToggleHidden: PropTypes.func.isRequired,
    paused: PropTypes.bool,
    onPause: PropTypes.func,
    onResume: PropTypes.func,
    onRestart: PropTypes.func,
    onExit: PropTypes.func
};

export default TouchControls;
