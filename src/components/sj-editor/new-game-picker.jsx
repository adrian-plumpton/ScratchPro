// Sparkjam: "Start a new game" (design M4). Shown when the editor opens from Start making
// (editor.html?new). Every template already runs; Blank keeps the empty project.

import bindAll from 'lodash.bindall';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {Lumi} from '../sj/pixel-art.jsx';
import sj from '../sj/sj.css';
import {sampleFileUrl} from '../../lib/sample-games';
import {links} from '../../lib/sj-links';
import {
    LoadingState,
    getIsShowingProject,
    onLoadedProject,
    requestProjectUpload
} from '../../reducers/project-state';
import {openLoadingProject, closeLoadingProject} from '../../reducers/modals';
import {setProjectTitle} from '../../reducers/project-title';
import {setFileHandle} from '../../reducers/tw';
import log from '../../lib/log';
import styles from './new-game-picker.css';

const TEMPLATES = [
    {id: 'spark-hop',
        name: 'PLATFORMER',
        text: 'Run, jump and collect.',
        tags: ['JOYSTICK + JUMP', 'BEGINNER'],
        title: 'My platformer'},
    {id: 'lane-dash',
        name: 'RACER',
        text: 'Dodge traffic at speed.',
        tags: ['JOYSTICK + BOOST', 'BEGINNER'],
        title: 'My racer'},
    {id: 'bubble-pop',
        name: 'TAP GAME',
        text: 'Tap things before they escape.',
        tags: ['TAP ONLY', 'EASIEST'],
        title: 'My tap game'},
    {id: 'gem-maze',
        name: 'MAZE',
        text: 'Explore and find treasure.',
        tags: ['JOYSTICK', 'BEGINNER'],
        title: 'My maze'},
    {id: 'blank', name: 'BLANK', text: 'An empty stage and one sprite.', tags: ['YOUR IDEA'], title: null}
];

/** @returns {boolean} True when the editor was opened to start a new game. */
const wantsNewGamePicker = () => typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has('new');

// Forget ?new so reloading the page doesn't ask again.
const clearNewParam = () => {
    const params = new URLSearchParams(location.search);
    params.delete('new');
    const search = params.toString();
    history.replaceState(null, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
};

class NewGamePicker extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleSelect', 'handleStart', 'handleClose', 'handleKeyDown', 'handleOpenFile',
            'handleFileChosen', 'setFileInput']);
        this.state = {open: wantsNewGamePicker(), selected: 'spark-hop', busy: false, failed: false};
        this.fileInput = null;
    }
    componentDidMount () {
        document.addEventListener('keydown', this.handleKeyDown);
    }
    componentWillUnmount () {
        document.removeEventListener('keydown', this.handleKeyDown);
    }
    handleKeyDown (e) {
        if (this.state.open && e.key === 'Escape') this.handleClose();
    }
    handleSelect (e) {
        this.setState({selected: e.currentTarget.dataset.id});
    }
    handleClose () {
        clearNewParam();
        this.setState({open: false});
    }
    async loadBuffer (getBuffer, title) {
        if (this.state.busy || !this.props.isShowingProject) return;
        this.setState({busy: true, failed: false});
        let started = false;
        try {
            const buffer = await getBuffer();
            this.props.onStartLoading(this.props.loadingState);
            started = true;
            await this.props.vm.loadProject(buffer);
            this.props.onFinishLoading(true, title);
            this.handleClose();
        } catch (err) {
            log.error('Could not start the new game', err);
            if (started) this.props.onFinishLoading(false);
            this.setState({failed: true});
        }
        this.setState({busy: false});
    }
    handleStart () {
        const template = TEMPLATES.find(t => t.id === this.state.selected);
        if (template.id === 'blank') {
            this.handleClose();
            return;
        }
        this.loadBuffer(async () => {
            const response = await fetch(sampleFileUrl(template.id, 'sb3'));
            if (!response.ok) throw new Error(`Request returned status ${response.status}`);
            return response.arrayBuffer();
        }, template.title);
    }
    handleOpenFile () {
        if (this.fileInput) this.fileInput.click();
    }
    handleFileChosen (e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        this.loadBuffer(() => file.arrayBuffer(), file.name.replace(/\.sb[23]?$/i, ''));
    }
    setFileInput (el) {
        this.fileInput = el;
    }
    render () {
        if (!this.state.open) return null;
        const selected = TEMPLATES.find(t => t.id === this.state.selected);
        return (
            <div className={classNames(sj.tokens, styles.backdrop)}>
                <div
                    className={styles.modal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="sj-new-game-title"
                >
                    <div className={styles.head}>
                        <Lumi
                            arms="wave"
                            eyes="happy"
                            px={4}
                        />
                        <h2
                            className={styles.title}
                            id="sj-new-game-title"
                        >{'START A NEW GAME'}</h2>
                        <button
                            className={styles.close}
                            onClick={this.handleClose}
                            aria-label="Close"
                        >{'✕'}</button>
                    </div>
                    <p className={styles.sub}>
                        {'Every start already runs. Press ▶ straight away, then make it yours.'}
                    </p>
                    <div
                        className={styles.cards}
                        role="radiogroup"
                        aria-label="Templates"
                    >
                        {TEMPLATES.map(t => (
                            <button
                                key={t.id}
                                data-id={t.id}
                                className={classNames(styles.card, {[styles.on]: t.id === this.state.selected})}
                                role="radio"
                                aria-checked={t.id === this.state.selected}
                                onClick={this.handleSelect}
                                onDoubleClick={this.handleStart}
                            >
                                {t.id === 'blank' ? (
                                    <span className={styles.blankArt}>
                                        <Lumi px={4} />
                                    </span>
                                ) : (
                                    <img
                                        className={styles.art}
                                        src={links.thumbnail(t.id)}
                                        alt=""
                                    />
                                )}
                                <span className={styles.body}>
                                    <span className={styles.name}>{t.name}</span>
                                    <span className={styles.text}>{t.text}</span>
                                    <span className={styles.tags}>
                                        {t.tags.map(tag => <span key={tag}>{tag}</span>)}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                    {this.state.failed ? (
                        <p
                            className={styles.error}
                            role="alert"
                        >{'That didn\'t open. Check your connection, or try another start.'}</p>
                    ) : null}
                    <div className={styles.foot}>
                        <button
                            className={styles.link}
                            onClick={this.handleOpenFile}
                        >{'Open a file from this device'}</button>
                        <input
                            ref={this.setFileInput}
                            type="file"
                            accept=".sb3,.sb2,.sb"
                            hidden
                            onChange={this.handleFileChosen}
                        />
                        <a
                            className={styles.link}
                            href={links.games}
                        >{'Remix a sample game'}</a>
                        <button
                            className={classNames(sj.btn, styles.start)}
                            onClick={this.handleStart}
                            disabled={this.state.busy}
                        >
                            {this.state.busy ? 'LOADING...' : `▶ START WITH ${selected.name}`}
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}

NewGamePicker.propTypes = {
    isShowingProject: PropTypes.bool,
    loadingState: PropTypes.string,
    onFinishLoading: PropTypes.func,
    onStartLoading: PropTypes.func,
    vm: PropTypes.shape({
        loadProject: PropTypes.func
    })
};

const mapStateToProps = state => ({
    isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
    loadingState: state.scratchGui.projectState.loadingState,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onStartLoading: loadingState => {
        dispatch(openLoadingProject());
        dispatch(requestProjectUpload(loadingState));
    },
    onFinishLoading: (success, title) => {
        dispatch(onLoadedProject(LoadingState.LOADING_VM_FILE_UPLOAD, false, success));
        dispatch(closeLoadingProject());
        if (success) {
            dispatch(setFileHandle(null));
            if (title) dispatch(setProjectTitle(title));
        }
    }
});

export {wantsNewGamePicker};
export default connect(mapStateToProps, mapDispatchToProps)(NewGamePicker);
