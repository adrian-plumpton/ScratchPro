// Sparkjam: keeps the game being edited in "My games". A couple of seconds after each change the game
// is saved in this browser and, for a signed-in maker, to their account too. The first save adds it to
// My games and puts ?game=<id> in the address so a reload opens it again. Loading a different game
// starts a new entry.

import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {getGame, saveGame} from '../../lib/sj-library';
import {listCloudGames, saveCloudGame} from '../../lib/sj-cloud';
import {getAccount, isAccountReady, onAccount, startAuth} from '../../lib/sj-auth';
import {setProjectTitle} from '../../reducers/project-title';
import {setSaveStatus} from '../../lib/sj-save-status';
import {isJamLoading} from '../../lib/sj-jam';
import log from '../../lib/log';

const SAVE_DELAY = 2000;
// Changes reported while a project is still settling after loading aren't edits.
// Extensions (like the Phone blocks) can finish loading a few seconds later.
const SETTLE_TIME = 5000;
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
        startAuth();
        this.stopAccount = onAccount(() => setSaveStatus({account: isAccountReady(getAccount())}));
        setSaveStatus({state: this.gameId ? 'saved' : 'idle', savedAt: null, account: isAccountReady(getAccount())});
    }
    componentWillUnmount () {
        this.props.vm.off('PROJECT_CHANGED', this.handleChanged);
        this.props.vm.runtime.off('PROJECT_LOADED', this.handleLoaded);
        document.removeEventListener('visibilitychange', this.handleHidden);
        if (this.stopAccount) this.stopAccount();
        clearTimeout(this.timer);
    }
    handleLoaded () {
        this.loadedAt = Date.now();
        clearTimeout(this.timer);
        // The first load is the game in the address; anything loaded after that is a different game.
        // A jam reloading its game is still the same game.
        if (isJamLoading()) return;
        if (this.firstLoad) {
            this.firstLoad = false;
            // A game reopened from My games gets its saved name back.
            if (this.gameId) {
                const id = this.gameId;
                getGame(id)
                    .catch(() => null)
                    .then(async game => {
                        if (game) return game;
                        // Opened from the account rather than this device.
                        if (!isAccountReady(await startAuth())) return null;
                        return (await listCloudGames()).find(g => g.id === id);
                    })
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
        // Nothing counts as an edit until a game has loaded and settled.
        if (this.props.isPlayerOnly || !this.loadedAt || Date.now() - this.loadedAt < SETTLE_TIME) return;
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
                const game = {
                    id: this.gameId,
                    title: this.props.projectTitle || 'Untitled game',
                    sb3,
                    thumbnail: picture
                };
                let id = null;
                try {
                    id = await saveGame(game);
                } catch (err) {
                    // This browser can't save games (eg. private browsing); the account still can.
                    log.warn('Could not save the game in this browser', err);
                    id = this.gameId || Array.from(crypto.getRandomValues(new Uint8Array(8)),
                        b => b.toString(16).padStart(2, '0')).join('');
                }
                if (id !== this.gameId) {
                    this.gameId = id;
                    setGameParam(id);
                }
                let where = 'device';
                if (isAccountReady(getAccount())) {
                    try {
                        await saveCloudGame({...game, id});
                        where = 'account';
                    } catch (err) {
                        log.error('Could not save the game to the account', err);
                        setSaveStatus({state: 'saved', where: 'device', cloudError: err.message, savedAt: Date.now()});
                        return;
                    }
                }
                setSaveStatus({state: 'saved', where, cloudError: null, savedAt: Date.now()});
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
