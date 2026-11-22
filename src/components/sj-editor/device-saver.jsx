// Sparkjam: keeps the game being edited in "My games" (saved in this browser). A couple of seconds
// after each change, the game is saved; the first save adds it to My games and puts ?game=<id> in
// the address so a reload opens it again. Loading a different game starts a new entry.

import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {getGame, saveGame} from '../../lib/sj-library';
import {setProjectTitle} from '../../reducers/project-title';
import {setSaveStatus} from '../../lib/sj-save-status';
import log from '../../lib/log';

const SAVE_DELAY = 2000;
// Changes reported while a project is still settling after loading aren't edits.
const SETTLE_TIME = 1500;
const THUMBNAIL_WIDTH = 320;

const params = () => new URLSearchParams(location.search);

const setGameParam = id => {
    const next = params();
    ['game', 'sample', 'new', 'blank'].forEach(name => next.delete(name));
    if (id) next.set('game', id);
    const search = next.toString();
    history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
};

const thumbnail = vm => new Promise(resolve => {
    if (!vm.renderer) {
        resolve(null);
        return;
    }
    vm.renderer.requestSnapshot(dataURL => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = THUMBNAIL_WIDTH;
            canvas.height = Math.round(THUMBNAIL_WIDTH * img.height / img.width);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(null);
        img.src = dataURL;
    });
});

class DeviceSaver extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, ['handleChanged', 'handleLoaded', 'handleHidden', 'save']);
        this.gameId = params().get('game');
        this.firstLoad = true;
        this.loadedAt = 0;
        this.timer = null;
        this.saving = null;
    }
    componentDidMount () {
        this.props.vm.on('PROJECT_CHANGED', this.handleChanged);
        this.props.vm.runtime.on('PROJECT_LOADED', this.handleLoaded);
        document.addEventListener('visibilitychange', this.handleHidden);
        setSaveStatus({state: this.gameId ? 'saved' : 'idle', savedAt: null});
    }
    componentWillUnmount () {
        this.props.vm.off('PROJECT_CHANGED', this.handleChanged);
        this.props.vm.runtime.off('PROJECT_LOADED', this.handleLoaded);
        document.removeEventListener('visibilitychange', this.handleHidden);
        clearTimeout(this.timer);
    }
    handleLoaded () {
        this.loadedAt = Date.now();
        clearTimeout(this.timer);
        // The first load is the game in the address; anything loaded after that is a different game.
        if (this.firstLoad) {
            this.firstLoad = false;
            // A game reopened from My games gets its saved name back.
            if (this.gameId) {
                getGame(this.gameId)
                    .then(game => {
                        if (game && game.title) this.props.onSetTitle(game.title);
                    })
                    .catch(() => {});
            }
            return;
        }
        this.gameId = null;
        setGameParam(null);
        setSaveStatus({state: 'idle', savedAt: null});
    }
    handleChanged () {
        if (this.props.isPlayerOnly || Date.now() - this.loadedAt < SETTLE_TIME) return;
        setSaveStatus({state: 'unsaved'});
        clearTimeout(this.timer);
        this.timer = setTimeout(this.save, SAVE_DELAY);
    }
    handleHidden () {
        if (document.visibilityState === 'hidden' && this.timer) {
            clearTimeout(this.timer);
            this.save();
        }
    }
    async save () {
        this.timer = null;
        if (this.saving) {
            // Save again once the current save is done, so the latest change is kept.
            await this.saving;
            return this.save();
        }
        setSaveStatus({state: 'saving'});
        this.saving = (async () => {
            try {
                const [sb3, picture] = await Promise.all([
                    this.props.vm.saveProjectSb3(),
                    thumbnail(this.props.vm)
                ]);
                const id = await saveGame({
                    id: this.gameId,
                    title: this.props.projectTitle || 'Untitled game',
                    sb3,
                    thumbnail: picture
                });
                if (id !== this.gameId) {
                    this.gameId = id;
                    setGameParam(id);
                }
                setSaveStatus({state: 'saved', savedAt: Date.now()});
            } catch (err) {
                log.error('Could not save the game on this device', err);
                setSaveStatus({state: 'error'});
            }
        })();
        await this.saving;
        this.saving = null;
    }
    render () {
        return null;
    }
}

DeviceSaver.propTypes = {
    isPlayerOnly: PropTypes.bool,
    onSetTitle: PropTypes.func,
    projectTitle: PropTypes.string,
    vm: PropTypes.shape({
        on: PropTypes.func,
        off: PropTypes.func,
        runtime: PropTypes.shape({
            on: PropTypes.func,
            off: PropTypes.func
        }),
        renderer: PropTypes.object,
        saveProjectSb3: PropTypes.func
    }).isRequired
};

export default connect(
    state => ({
        isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
        projectTitle: state.scratchGui.projectTitle,
        vm: state.scratchGui.vm
    }),
    dispatch => ({
        onSetTitle: title => dispatch(setProjectTitle(title))
    })
)(DeviceSaver);
