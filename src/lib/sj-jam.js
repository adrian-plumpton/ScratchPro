// Sparkjam: live jams. Everyone in a jam has their own copy of the game; this keeps the copies in step
// through a Liveblocks room (see netlify/functions/jam-auth.mjs):
//
//  - Block edits (create, move, change, delete, variables) are sent as they happen and applied to
//    everyone's game, and to their code area when they're looking at the same sprite.
//  - Sprite position, size and costume changes are sent as small updates.
//  - Anything bigger (new or renamed sprites, costumes, sounds) sends the whole game: it's saved to the
//    jam's copy (netlify/functions/jams.mjs) and everyone reloads it.
//  - Someone joining gets a fresh copy from someone already there (the "keeper": whoever has been in
//    the room longest), or the last saved copy.
//  - Presence: who's here, which sprite and tab they're on, and their cursor in the code area.
//
// Edits made at the same moment to the same blocks can still clash; the last one wins.

import {createClient} from '@liveblocks/client';
import {loadJamSnapshot, saveJamSnapshot} from './sj-jam-api';
import log from './log';

const BLOCK_EVENTS = ['create', 'delete', 'move', 'change', 'var_create', 'var_rename', 'var_delete'];
const STAGE = '__stage__';
const SNAPSHOT_WAIT = 8000;
const KEEPER_SAVE_EVERY = 20000;
const GAME_SYNC_DELAY = 1000;
// Live drags: how often positions are sent while something is being dragged, and how long a
// drag shown from someone else lasts if its end never arrives.
const DRAG_EVERY = 60;
const GHOST_TIMEOUT = 3000;

let state = {status: 'idle', code: null, jam: null, others: [], self: null, error: null, activity: []};
const listeners = new Set();
const setState = next => {
    state = {...state, ...next};
    listeners.forEach(listener => listener(state));
};
const getJamState = () => state;
const onJamState = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

let session = null;

// Local testing only: on localhost a test can stand in for Liveblocks and the jams API
// (window.__sjJamTest = {createClient, loadSnapshot, saveSnapshot}). See test/smoke/jam-sync.mjs.
const testHooks = () => (typeof location !== 'undefined' && location.hostname === 'localhost' &&
    window.__sjJamTest) || null;
// True while a jam is loading a game into the editor, so My games keeps it as the same game.
let jamLoading = false;
const isJamLoading = () => jamLoading;

/**
 * The game as an .sb3 for the jam. Normal saves shorten block ids; a jam keeps them, because
 * everyone's edits refer to blocks by id.
 * @param {object} vm The VM.
 * @returns {Promise<Blob>} The game.
 */
const saveForJam = vm => {
    const toJSON = vm.toJSON;
    vm.toJSON = function (targetId, options) {
        return toJSON.call(this, targetId, {...options, allowOptimization: false});
    };
    try {
        // The game is turned into JSON straight away; only the zipping happens later.
        return vm.saveProjectSb3();
    } finally {
        vm.toJSON = toJSON;
    }
};

const targetName = target => (target.isStage ? STAGE : target.getName());

const addActivity = text => {
    const item = {id: `${Date.now()}-${Math.random()}`, text, at: Date.now()};
    setState({activity: [...state.activity, item].slice(-3)});
    setTimeout(() => setState({activity: state.activity.filter(a => a.id !== item.id)}), 6000);
};

// What the game looks like structurally: changing any of this sends the whole game.
const structureOf = vm => JSON.stringify(vm.runtime.targets.filter(t => t.isOriginal).map(t => [
    targetName(t),
    t.getCostumes().map(c => [c.name, c.assetId, c.rotationCenterX, c.rotationCenterY]),
    t.getSounds().map(s => [s.name, s.assetId])
])
    .concat([vm.extensionManager ? [...vm.extensionManager._loadedExtensions.keys()].sort() : []]));

const propsOf = vm => {
    const props = {};
    vm.runtime.targets.forEach(t => {
        if (!t.isOriginal || t.isStage) return;
        props[t.getName()] = [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100, t.direction, t.size,
            t.visible, t.currentCostume, t.rotationStyle, t.draggable];
    });
    return props;
};

class JamSession {
    constructor (vm, jam, {needsGame}) {
        this.vm = vm;
        this.jam = jam;
        this.needsGame = needsGame;
        this.client = null;
        this.room = null;
        this.leaveRoom = null;
        this.workspace = null;
        this.applyingRemote = false;
        this.suppressWorkspace = false;
        this.loaded = !needsGame;
        this.buffer = [];
        this.waitingForSnapshot = null;
        this.dirty = false;
        this.lastStructure = null;
        this.lastProps = null;
        this.gameTimer = null;
        this.keeperTimer = null;
        this.unsubscribers = [];
        this.dragLoop = 0;
        this.localDrag = null;
        this.lastDragSent = 0;
        this.ghosts = new Map();
        [
            'handleWorkspaceEvent', 'handleWorkspaceUpdate', 'handleProjectChanged', 'handleRoomEvent',
            'handleOthers', 'handleTargetsUpdate', 'keeperSave', 'watchDrags'
        ].forEach(name => {
            this[name] = this[name].bind(this);
        });
    }

    async start () {
        setState({status: 'joining', code: this.jam.code, jam: this.jam, error: null});
        const makeClient = (testHooks() && testHooks().createClient) || createClient;
        this.client = makeClient({
            throttle: 80,
            authEndpoint: async room => {
                const response = await fetch(`${process.env.ROOT || '/'}api/jam-auth`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({room}),
                    credentials: 'same-origin'
                });
                if (!response.ok) {
                    let message = 'Couldn\'t join the jam.';
                    try {
                        message = (await response.json()).error || message;
                    } catch (e) {
                        // Not JSON.
                    }
                    setState({status: 'error', error: message});
                    throw new Error(message);
                }
                return response.json();
            }
        });
        const {room, leave} = this.client.enterRoom(this.jam.roomId, {
            initialPresence: {target: null, tab: 'code', cursor: null}
        });
        this.room = room;
        this.leaveRoom = leave;
        this.unsubscribers.push(room.subscribe('others', this.handleOthers));
        this.unsubscribers.push(room.subscribe('event', this.handleRoomEvent));
        this.unsubscribers.push(room.subscribe('status', status => {
            if (status === 'reconnecting') setState({status: 'reconnecting'});
            if (status === 'connected' && this.loaded) setState({status: 'live'});
        }));

        await this.waitForConnection();
        if (state.status === 'error') return;
        setState({self: this.selfInfo()});

        this.vm.on('workspaceUpdate', this.handleWorkspaceUpdate);
        this.vm.on('targetsUpdate', this.handleTargetsUpdate);
        this.vm.on('PROJECT_CHANGED', this.handleProjectChanged);
        this.attachWorkspace();

        if (this.needsGame) await this.fetchGame();
        this.lastStructure = structureOf(this.vm);
        this.lastProps = propsOf(this.vm);
        this.loaded = true;
        this.buffer.forEach(item => this.applyRemote(item));
        this.buffer = [];
        this.updatePresence();
        this.keeperTimer = setInterval(this.keeperSave, KEEPER_SAVE_EVERY);
        this.dragLoop = requestAnimationFrame(this.watchDrags);
        setState({status: 'live'});
    }

    waitForConnection () {
        return new Promise(resolve => {
            const check = () => {
                if (this.room.getStatus() === 'connected' || state.status === 'error') {
                    resolve();
                    return true;
                }
                return false;
            };
            if (check()) return;
            const stop = this.room.subscribe('status', () => {
                if (check()) stop();
            });
            const watch = onJamState(() => {
                if (state.status === 'error') {
                    watch();
                    resolve();
                }
            });
        });
    }

    selfInfo () {
        const self = this.room.getSelf();
        return self ? {connectionId: self.connectionId, id: self.id, ...self.info} : null;
    }

    handleOthers (others) {
        const before = new Map(state.others.map(o => [o.connectionId, o]));
        const list = others.map(o => ({
            connectionId: o.connectionId,
            id: o.id,
            name: o.info && o.info.name,
            color: o.info && o.info.color,
            host: !!(o.info && o.info.host),
            target: o.presence && o.presence.target,
            tab: o.presence && o.presence.tab,
            cursor: o.presence && o.presence.cursor
        }));
        list.forEach(o => {
            const was = before.get(o.connectionId);
            if (!was) addActivity(`${o.name} joined`);
            else if (o.target && was.target !== o.target && o.target !== STAGE) {
                addActivity(`${o.name} is on ${o.target}`);
            }
        });
        before.forEach(o => {
            if (!list.some(n => n.connectionId === o.connectionId)) addActivity(`${o.name} left`);
        });
        setState({others: list});
    }

    // The keeper is whoever has been in the room longest (lowest connection id). They answer requests
    // for the game and keep the jam's saved copy up to date.
    isKeeper () {
        const self = this.room.getSelf();
        if (!self) return false;
        return this.room.getOthers().every(o => o.connectionId > self.connectionId);
    }

    async fetchGame () {
        const others = this.room.getOthers();
        if (others.length) {
            const self = this.room.getSelf();
            const answered = new Promise(resolve => {
                this.waitingForSnapshot = resolve;
                setTimeout(() => resolve(false), SNAPSHOT_WAIT);
            });
            this.room.broadcastEvent({type: 'need-game', from: self.connectionId});
            await answered;
            this.waitingForSnapshot = null;
        }
        await this.loadSnapshot();
    }

    async loadSnapshot () {
        const editing = this.vm.editingTarget ? targetName(this.vm.editingTarget) : null;
        const data = await ((testHooks() && testHooks().loadSnapshot) || loadJamSnapshot)(this.jam.code);
        jamLoading = true;
        try {
            this.applyingRemote = true;
            await this.vm.loadProject(data);
        } finally {
            this.applyingRemote = false;
            setTimeout(() => {
                jamLoading = false;
            }, 0);
        }
        // Stay on the sprite you were on.
        if (editing) {
            const target = editing === STAGE ? this.vm.runtime.getTargetForStage() :
                this.vm.runtime.getSpriteTargetByName(editing);
            if (target) this.vm.setEditingTarget(target.id);
        }
        this.lastStructure = structureOf(this.vm);
        this.lastProps = propsOf(this.vm);
    }

    async uploadSnapshot () {
        const sb3 = await saveForJam(this.vm);
        await ((testHooks() && testHooks().saveSnapshot) || saveJamSnapshot)(this.jam.code, sb3);
        this.dirty = false;
    }

    async keeperSave () {
        if (!this.dirty || !this.isKeeper()) return;
        try {
            await this.uploadSnapshot();
        } catch (e) {
            log.warn('Jam: could not save the jam\'s copy', e);
        }
    }

    // Workspace: capture local block edits.
    attachWorkspace () {
        const ScratchBlocks = window.ScratchBlocks;
        const workspace = ScratchBlocks && ScratchBlocks.getMainWorkspace && ScratchBlocks.getMainWorkspace();
        if (!workspace || workspace === this.workspace) return;
        if (this.workspace) this.workspace.removeChangeListener(this.handleWorkspaceEvent);
        this.workspace = workspace;
        workspace.addChangeListener(this.handleWorkspaceEvent);
    }

    handleWorkspaceUpdate () {
        // Loading a sprite's blocks into the code area fires events a moment later; they aren't edits.
        this.suppressWorkspace = true;
        setTimeout(() => setTimeout(() => {
            this.suppressWorkspace = false;
        }, 0), 0);
        [...this.ghosts.keys()].forEach(key => this.removeGhost(key));
        this.attachWorkspace();
        this.updatePresence();
    }

    handleTargetsUpdate () {
        this.updatePresence();
    }

    handleWorkspaceEvent (e) {
        if (this.suppressWorkspace || this.applyingRemote || !this.loaded) return;
        if (!BLOCK_EVENTS.includes(e.type) || !this.vm.editingTarget) return;
        if (e.workspaceId !== this.workspace.id) return;
        const json = e.toJson();
        // Blockly leaves out where a moved block came from; the game engine needs it.
        if (e.type === 'move') {
            json.oldParentId = e.oldParentId;
            json.oldInputName = e.oldInputName;
        }
        this.room.broadcastEvent({type: 'block', target: targetName(this.vm.editingTarget), json});
        this.dirty = true;
    }

    handleProjectChanged () {
        if (this.applyingRemote || !this.loaded) return;
        this.dirty = true;
        clearTimeout(this.gameTimer);
        this.gameTimer = setTimeout(() => this.syncGame(), GAME_SYNC_DELAY);
    }

    async syncGame () {
        if (this.applyingRemote || !this.room) return;
        const structure = structureOf(this.vm);
        if (structure !== this.lastStructure) {
            this.lastStructure = structure;
            this.lastProps = propsOf(this.vm);
            try {
                await this.uploadSnapshot();
                this.room.broadcastEvent({type: 'reload'});
            } catch (e) {
                log.error('Jam: could not share the game', e);
                addActivity('Couldn\'t share that change. Try again in a moment.');
            }
            return;
        }
        const props = propsOf(this.vm);
        const changed = {};
        Object.keys(props).forEach(name => {
            if (JSON.stringify(props[name]) !== JSON.stringify(this.lastProps[name])) changed[name] = props[name];
        });
        this.lastProps = props;
        if (Object.keys(changed).length) this.room.broadcastEvent({type: 'props', targets: changed});
    }

    handleRoomEvent ({event, user, connectionId}) {
        if (!event || typeof event !== 'object') return;
        const name = (user && user.info && user.info.name) || 'Someone';
        if (event.type === 'need-game') {
            if (this.loaded && this.isKeeper()) {
                this.uploadSnapshot()
                    .then(() => this.room.broadcastEvent({type: 'game-ready', for: event.from}))
                    .catch(e => log.warn('Jam: could not send the game', e));
            }
            return;
        }
        if (event.type === 'game-ready') {
            const self = this.room.getSelf();
            if (this.waitingForSnapshot && self && event.for === self.connectionId) this.waitingForSnapshot(true);
            return;
        }
        if (event.type === 'ended') {
            this.stop();
            setState({status: 'ended', error: `${name} ended the jam.`});
            return;
        }
        if (event.type === 'kick') {
            const self = this.room.getSelf();
            if (self && event.userId === self.id) {
                this.stop();
                setState({status: 'ended', error: 'You were removed from the jam.'});
            }
            return;
        }
        if (!this.loaded) {
            if (event.type === 'block' || event.type === 'props') this.buffer.push(event);
            return;
        }
        if (event.type === 'drag') {
            this.showGhost(event, (user && user.info && user.info.color) || '#c9a7ff', connectionId);
            return;
        }
        if (event.type === 'drag-end') {
            this.removeGhost(connectionId);
            return;
        }
        if (event.type === 'sprite-drag') {
            const sprite = this.vm.runtime.getSpriteTargetByName(event.name);
            if (sprite && !sprite.dragging) {
                this.applyingRemote = true;
                try {
                    sprite.setXY(event.x, event.y);
                } finally {
                    this.applyingRemote = false;
                }
            }
            return;
        }
        if (event.type === 'reload') {
            addActivity(`${name} changed the game`);
            this.loadSnapshot().catch(e => log.error('Jam: could not load the game', e));
            return;
        }
        this.applyRemote(event, connectionId);
    }

    findTarget (name) {
        return name === STAGE ? this.vm.runtime.getTargetForStage() : this.vm.runtime.getSpriteTargetByName(name);
    }

    applyRemote (event) {
        this.applyingRemote = true;
        try {
            if (event.type === 'block') this.applyBlockEvent(event.target, event.json);
            if (event.type === 'props') this.applyProps(event.targets);
        } catch (e) {
            log.warn('Jam: could not apply a change', e);
        } finally {
            this.applyingRemote = false;
        }
        this.lastProps = propsOf(this.vm);
        this.dirty = true;
    }

    applyProps (targets) {
        Object.keys(targets).forEach(name => {
            const target = this.vm.runtime.getSpriteTargetByName(name);
            if (!target) return;
            const [x, y, direction, size, visible, costume, rotationStyle, draggable] = targets[name];
            target.setXY(x, y);
            target.setDirection(direction);
            target.setSize(size);
            target.setVisible(visible);
            target.setCostume(costume);
            target.setRotationStyle(rotationStyle);
            target.setDraggable(draggable);
        });
    }

    applyBlockEvent (name, json) {
        const target = this.findTarget(name);
        if (!target) return;
        // 1. The game engine.
        if (json.type === 'var_create') {
            const owner = json.isLocal ? target : this.vm.runtime.getTargetForStage();
            if (!owner.lookupVariableById(json.varId)) {
                owner.createVariable(json.varId, json.varName, json.varType, json.isCloud);
            }
        } else if (json.type === 'var_rename') {
            const owner = target.lookupVariableById(json.varId) ? target : this.vm.runtime.getTargetForStage();
            owner.renameVariable(json.varId, json.newName);
        } else if (json.type === 'var_delete') {
            const owner = target.variables[json.varId] ? target : this.vm.runtime.getTargetForStage();
            owner.deleteVariable(json.varId);
        } else {
            const vmEvent = {...json};
            if (json.xml) vmEvent.xml = {outerHTML: json.xml};
            if (typeof json.newCoordinate === 'string') {
                const [x, y] = json.newCoordinate.split(',').map(Number);
                vmEvent.newCoordinate = {x, y};
            }
            target.blocks.blocklyListen(vmEvent);
        }
        // 2. The code area, if it's showing this sprite.
        const ScratchBlocks = window.ScratchBlocks;
        if (this.workspace && this.vm.editingTarget === target && ScratchBlocks) {
            ScratchBlocks.Events.disable();
            try {
                ScratchBlocks.Events.fromJson(json, this.workspace).run(true);
            } finally {
                ScratchBlocks.Events.enable();
            }
        }
        // No full code-area refresh here: a refresh reloads from a copy taken a moment earlier and would
        // briefly undo changes (eg. bring back a block that was just deleted).
    }

    // Live drags. Every frame, look for a block being dragged in my code area or a sprite being dragged
    // on my stage, and send where it is (a few times a second).
    watchDrags () {
        if (!this.room) return;
        this.dragLoop = requestAnimationFrame(this.watchDrags);
        const now = Date.now();
        const drag = this.currentBlockDrag();
        if (drag) {
            this.localDrag = drag.blockId;
            if (now - this.lastDragSent >= DRAG_EVERY) {
                this.lastDragSent = now;
                this.room.broadcastEvent({type: 'drag', target: targetName(this.vm.editingTarget), ...drag});
            }
        } else if (this.localDrag) {
            this.localDrag = null;
            this.room.broadcastEvent({type: 'drag-end'});
        }
        if (now - this.lastDragSent >= DRAG_EVERY) {
            const sprite = this.vm.runtime.targets.find(t => t.isOriginal && !t.isStage && t.dragging);
            if (sprite) {
                this.lastDragSent = now;
                this.room.broadcastEvent({type: 'sprite-drag', name: sprite.getName(), x: sprite.x, y: sprite.y});
            }
        }
        // Forget drags whose end never arrived.
        this.ghosts.forEach((ghost, key) => {
            if (now - ghost.at > GHOST_TIMEOUT) this.removeGhost(key);
        });
    }

    currentBlockDrag () {
        const gesture = this.workspace && this.workspace.currentGesture_;
        const dragger = gesture && gesture.isDraggingBlock_ && gesture.blockDragger_;
        const block = dragger && dragger.draggingBlock_;
        if (!block || !dragger.startXY_ || !gesture.currentDragDeltaXY_) return null;
        const delta = dragger.pixelsToWorkspaceUnits_(gesture.currentDragDeltaXY_);
        return {
            blockId: block.id,
            x: Math.round(dragger.startXY_.x + delta.x),
            y: Math.round(dragger.startXY_.y + delta.y)
        };
    }

    // Someone else is dragging blocks: show a see-through copy of them, outlined in their colour, that
    // follows their drag. It goes when they drop (the real move arrives as a normal block edit).
    showGhost (event, color, key) {
        const editing = this.vm.editingTarget ? targetName(this.vm.editingTarget) : null;
        const block = this.workspace && event.target === editing && this.workspace.getBlockById(event.blockId);
        if (!block || !block.getSvgRoot()) {
            this.removeGhost(key);
            return;
        }
        let ghost = this.ghosts.get(key);
        if (!ghost || ghost.blockId !== event.blockId) {
            this.removeGhost(key);
            const svg = block.getSvgRoot().cloneNode(true);
            svg.removeAttribute('id');
            svg.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
            svg.style.opacity = '0.6';
            svg.style.pointerEvents = 'none';
            svg.style.filter = `drop-shadow(0 0 2px ${color}) drop-shadow(0 0 2px ${color})`;
            this.workspace.getCanvas().appendChild(svg);
            ghost = {svg, blockId: event.blockId};
            this.ghosts.set(key, ghost);
        }
        ghost.at = Date.now();
        ghost.svg.setAttribute('transform', `translate(${event.x},${event.y})`);
    }

    removeGhost (key) {
        const ghost = this.ghosts.get(key);
        if (ghost && ghost.svg.parentNode) ghost.svg.parentNode.removeChild(ghost.svg);
        this.ghosts.delete(key);
    }

    // Presence: where I am. tab is set by setJamTab; cursor by setJamCursor.
    updatePresence (extra) {
        if (!this.room) return;
        const target = this.vm.editingTarget ? targetName(this.vm.editingTarget) : null;
        this.room.updatePresence({target, ...extra});
    }

    broadcast (event) {
        if (this.room) this.room.broadcastEvent(event);
    }

    stop () {
        cancelAnimationFrame(this.dragLoop);
        [...this.ghosts.keys()].forEach(key => this.removeGhost(key));
        clearTimeout(this.gameTimer);
        clearInterval(this.keeperTimer);
        this.vm.off('workspaceUpdate', this.handleWorkspaceUpdate);
        this.vm.off('targetsUpdate', this.handleTargetsUpdate);
        this.vm.off('PROJECT_CHANGED', this.handleProjectChanged);
        if (this.workspace) this.workspace.removeChangeListener(this.handleWorkspaceEvent);
        this.unsubscribers.forEach(stop => stop());
        if (this.leaveRoom) this.leaveRoom();
        this.room = null;
    }
}

/**
 * Join (or, for the person who started it, open) a jam.
 * @param {object} vm The VM.
 * @param {object} jam The jam from the register.
 * @param {object} options {needsGame: load the jam's game first}.
 * @returns {Promise} Resolves once connected.
 */
const joinJam = (vm, jam, options) => {
    if (session) session.stop();
    session = new JamSession(vm, jam, options);
    return session.start().catch(e => {
        log.error('Jam: could not join', e);
        if (state.status !== 'error') setState({status: 'error', error: 'Couldn\'t connect to the jam.'});
    });
};

const leaveJam = () => {
    if (session) session.stop();
    session = null;
    setState({status: 'idle', code: null, jam: null, others: [], self: null, error: null, activity: []});
};

const broadcastJam = event => session && session.broadcast(event);

if (typeof window !== 'undefined' && typeof location !== 'undefined' && location.hostname === 'localhost') {
    window.__sjJam = {joinJam, getJamState, saveForJam};
}
const setJamTab = tab => session && session.updatePresence({tab});
const setJamCursor = cursor => session && session.updatePresence({cursor});

export {
    saveForJam,
    joinJam,
    leaveJam,
    getJamState,
    onJamState,
    isJamLoading,
    broadcastJam,
    setJamTab,
    setJamCursor
};
