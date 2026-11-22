// Sparkjam: voice and video in jams, browser to browser (WebRTC). Everyone in the call connects directly
// to everyone else; the jam's Liveblocks room carries the messages that set each connection up.
//
// Each connection is made once with an audio and a video slot, so turning the mic or camera on and
// off just swaps what goes in the slot. Mic and camera are off until you turn them on, and turning one
// off stops it completely (the browser's "in use" light goes off). Nothing is recorded.

import {getJamRoom, getJamState, onCallEvent, onJamState, updateJamPresence} from './sj-jam';
import log from './log';

const ICE_SERVERS = [{urls: 'stun:stun.l.google.com:19302'}, {urls: 'stun:stun.cloudflare.com:3478'}];
const SPEAKING_LEVEL = 0.04;

let state = {
    joined: false,
    micOn: false,
    camOn: false,
    localStream: null,
    peers: [], // [{connectionId, name, color, stream, volume, hidden}]
    speaking: [],
    micLevel: 0,
    devices: {mics: [], cams: [], speakers: []},
    micId: '',
    camId: '',
    speakerId: '',
    volume: 1,
    notice: null,
    error: null
};
const listeners = new Set();
const setState = next => {
    state = {...state, ...next};
    listeners.forEach(listener => listener(state));
};
const getCallState = () => state;
const onCallState = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

const peers = new Map(); // connectionId -> {pc, audioSender, videoSender, stream, audio, analyser, ...}
let audioTrack = null;
let videoTrack = null;
let audioContext = null;
let micAnalyser = null;
let meterTimer = 0;
let stopEvents = null;
let stopJam = null;

const myConnectionId = () => {
    const room = getJamRoom();
    const self = room && room.getSelf();
    return self ? self.connectionId : null;
};

const send = (to, message) => {
    const room = getJamRoom();
    if (room) room.broadcastEvent({type: 'rtc', to, ...message});
};

const publishPresence = () => updateJamPresence({inCall: state.joined, micOn: state.micOn, camOn: state.camOn});

const localStream = () => {
    const stream = new MediaStream();
    if (audioTrack) stream.addTrack(audioTrack);
    if (videoTrack) stream.addTrack(videoTrack);
    return stream;
};

const getContext = () => {
    if (!audioContext) {
        const Context = window.AudioContext || window.webkitAudioContext;
        audioContext = new Context();
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
};

const makeAnalyser = stream => {
    try {
        const context = getContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        return {analyser, source, data: new Uint8Array(analyser.fftSize)};
    } catch (e) {
        return null;
    }
};

const levelOf = meter => {
    if (!meter) return 0;
    meter.analyser.getByteTimeDomainData(meter.data);
    let sum = 0;
    for (let i = 0; i < meter.data.length; i++) {
        const v = (meter.data[i] - 128) / 128;
        sum += v * v;
    }
    return Math.sqrt(sum / meter.data.length);
};

const peerList = () => {
    const others = new Map(getJamState().others.map(o => [o.connectionId, o]));
    return [...peers.entries()].map(([connectionId, peer]) => {
        const other = others.get(connectionId) || {};
        return {
            connectionId,
            userId: other.id,
            name: other.name || 'Someone',
            color: other.color,
            micOn: !!other.micOn,
            camOn: !!other.camOn,
            stream: peer.stream,
            volume: peer.volume,
            hidden: peer.hidden
        };
    });
};

const refreshPeers = () => setState({peers: peerList()});

const applyVolume = peer => {
    if (peer.audio) peer.audio.volume = Math.max(0, Math.min(1, state.volume * peer.volume));
};

// One connection per person in the call. "Perfect negotiation": either side can start, and the
// "polite" side (the higher connection id) gives way if both start at once.
const connect = (connectionId, polite) => {
    if (peers.has(connectionId)) return peers.get(connectionId);
    const pc = new RTCPeerConnection({iceServers: ICE_SERVERS});
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    const peer = {
        pc,
        polite,
        audio,
        stream: new MediaStream(),
        volume: 1,
        hidden: false,
        makingOffer: false,
        ignoreOffer: false,
        meter: null
    };
    peer.audioSender = pc.addTransceiver('audio', {direction: 'sendrecv'}).sender;
    peer.videoSender = pc.addTransceiver('video', {direction: 'sendrecv'}).sender;
    if (audioTrack) peer.audioSender.replaceTrack(audioTrack);
    if (videoTrack) peer.videoSender.replaceTrack(videoTrack);
    if (state.speakerId && audio.setSinkId) audio.setSinkId(state.speakerId).catch(() => {});
    applyVolume(peer);

    pc.ontrack = ({track}) => {
        peer.stream.addTrack(track);
        if (track.kind === 'audio') {
            audio.srcObject = new MediaStream([track]);
            audio.play().catch(() => {});
            peer.meter = makeAnalyser(new MediaStream([track]));
        }
        peer.stream = new MediaStream(peer.stream.getTracks());
        refreshPeers();
    };
    pc.onicecandidate = ({candidate}) => {
        if (candidate) send(connectionId, {kind: 'candidate', candidate: candidate.toJSON()});
    };
    pc.onnegotiationneeded = async () => {
        try {
            peer.makingOffer = true;
            await pc.setLocalDescription();
            send(connectionId, {kind: 'description', description: pc.localDescription.toJSON()});
        } catch (e) {
            log.warn('Call: could not offer', e);
        } finally {
            peer.makingOffer = false;
        }
    };
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') pc.restartIce();
    };
    peers.set(connectionId, peer);
    refreshPeers();
    return peer;
};

const disconnect = connectionId => {
    const peer = peers.get(connectionId);
    if (!peer) return;
    peer.pc.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    peers.delete(connectionId);
    refreshPeers();
};

const processSignal = async (peer, event, from) => {
    const pc = peer.pc;
    try {
        if (event.kind === 'description') {
            const description = event.description;
            const collision = description.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
            peer.ignoreOffer = !peer.polite && collision;
            if (peer.ignoreOffer) return;
            await pc.setRemoteDescription(description);
            if (description.type === 'offer') {
                await pc.setLocalDescription();
                send(from, {kind: 'description', description: pc.localDescription.toJSON()});
            }
        } else if (event.kind === 'candidate') {
            try {
                await pc.addIceCandidate(event.candidate);
            } catch (e) {
                if (!peer.ignoreOffer) throw e;
            }
        }
    } catch (e) {
        log.warn('Call: signalling problem', e);
    }
};

const handleSignal = (event, user, from) => {
    const me = myConnectionId();
    if (event.type === 'call-control') {
        if (event.to !== me || !(user && user.info && user.info.host)) return;
        const name = (user.info && user.info.name) || 'The host';
        if (event.action === 'mute') {
            setMic(false); // eslint-disable-line no-use-before-define
            setState({notice: `${name} turned your mic off.`});
        }
        if (event.action === 'camera-off') {
            setCamera(false); // eslint-disable-line no-use-before-define
            setState({notice: `${name} turned your camera off.`});
        }
        return;
    }
    if (!state.joined) return;
    if (event.kind === 'join') {
        connect(from, me > from);
        send(from, {kind: 'here'});
        return;
    }
    if (event.kind === 'bye') {
        disconnect(from);
        return;
    }
    if (event.to !== me) return;
    if (event.kind === 'here') {
        connect(from, me > from);
        return;
    }
    const peer = peers.get(from) || connect(from, me > from);
    // Handle each person's messages strictly in order: a connection candidate that overtakes the
    // description it belongs to fails and is lost, and the call never connects.
    peer.queue = (peer.queue || Promise.resolve()).then(() => processSignal(peer, event, from));
    return peer.queue;
};


const listDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const named = (kind, label) => devices.filter(d => d.kind === kind).map((d, i) => ({
        id: d.deviceId,
        label: d.label || `${label} ${i + 1}`
    }));
    setState({devices: {
        mics: named('audioinput', 'Microphone'),
        cams: named('videoinput', 'Camera'),
        speakers: named('audiooutput', 'Speaker')
    }});
};

const startMeters = () => {
    if (meterTimer) return;
    meterTimer = setInterval(() => {
        const speaking = [];
        peers.forEach((peer, connectionId) => {
            if (levelOf(peer.meter) > SPEAKING_LEVEL) speaking.push(connectionId);
        });
        const micLevel = state.micOn ? levelOf(micAnalyser) : 0;
        if (micLevel > SPEAKING_LEVEL) speaking.push('me');
        if (speaking.join() !== state.speaking.join() || Math.abs(micLevel - state.micLevel) > 0.01) {
            setState({speaking, micLevel});
        }
    }, 150);
};

const mediaError = (e, what) => {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        return `Sparkjam isn't allowed to use your ${what}. Allow it in your browser's site settings and try again.`;
    }
    if (e && e.name === 'NotFoundError') return `No ${what} was found.`;
    return `Couldn't turn on your ${what}.`;
};

/**
 * Turn the microphone on or off. Off stops it completely.
 * @param {boolean} on On or off.
 * @returns {Promise} Resolves when done.
 */
const setMic = async on => {
    if (on && !audioTrack) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: state.micId ? {exact: state.micId} : undefined, // eslint-disable-line no-undefined
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            // A second tap while the first was waiting: keep the first microphone.
            if (audioTrack) stream.getTracks().forEach(t => t.stop());
            else audioTrack = stream.getAudioTracks()[0]; // eslint-disable-line require-atomic-updates
            micAnalyser = makeAnalyser(new MediaStream([audioTrack]));
            listDevices();
        } catch (e) {
            setState({error: mediaError(e, 'microphone')});
            return;
        }
    }
    if (!on && audioTrack) {
        audioTrack.stop();
        audioTrack = null;
        micAnalyser = null;
    }
    peers.forEach(peer => peer.audioSender.replaceTrack(audioTrack));
    setState({micOn: !!audioTrack, localStream: localStream(), error: null});
    publishPresence();
};

/**
 * Turn the camera on or off. Off stops it completely.
 * @param {boolean} on On or off.
 * @returns {Promise} Resolves when done.
 */
const setCamera = async on => {
    if (on && !videoTrack) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: state.camId ? {exact: state.camId} : undefined, // eslint-disable-line no-undefined
                    width: {ideal: 320},
                    height: {ideal: 240},
                    frameRate: {ideal: 15}
                }
            });
            if (videoTrack) stream.getTracks().forEach(t => t.stop());
            else videoTrack = stream.getVideoTracks()[0]; // eslint-disable-line require-atomic-updates
            listDevices();
        } catch (e) {
            setState({error: mediaError(e, 'camera')});
            return;
        }
    }
    if (!on && videoTrack) {
        videoTrack.stop();
        videoTrack = null;
    }
    peers.forEach(peer => peer.videoSender.replaceTrack(videoTrack));
    setState({camOn: !!videoTrack, localStream: localStream(), error: null});
    publishPresence();
};

/**
 * Choose a microphone; if the mic is on it switches over.
 * @param {string} id The device id.
 * @returns {Promise} Resolves when done.
 */
const chooseMic = async id => {
    setState({micId: id});
    if (audioTrack) {
        await setMic(false);
        await setMic(true);
    }
};
const chooseCamera = async id => {
    setState({camId: id});
    if (videoTrack) {
        await setCamera(false);
        await setCamera(true);
    }
};
const chooseSpeaker = id => {
    setState({speakerId: id});
    peers.forEach(peer => {
        if (peer.audio.setSinkId) peer.audio.setSinkId(id).catch(() => {});
    });
};
const setVolume = volume => {
    setState({volume});
    peers.forEach(applyVolume);
};
const setPeerVolume = (connectionId, volume) => {
    const peer = peers.get(connectionId);
    if (!peer) return;
    peer.volume = volume;
    applyVolume(peer);
    refreshPeers();
};
const hidePeerVideo = (connectionId, hidden) => {
    const peer = peers.get(connectionId);
    if (!peer) return;
    peer.hidden = hidden;
    refreshPeers();
};

/**
 * Host only: ask someone to turn their mic or camera off.
 * @param {number} connectionId Who.
 * @param {string} action 'mute' or 'camera-off'.
 */
const hostControl = (connectionId, action) => {
    const room = getJamRoom();
    if (room) room.broadcastEvent({type: 'call-control', to: connectionId, action});
};

/**
 * Join the jam's call. Mic and camera stay off until turned on.
 * @returns {void}
 */
const joinCall = () => {
    if (state.joined || !getJamRoom()) return;
    getContext();
    stopEvents = onCallEvent(handleSignal);
    // People leaving the jam leave the call; the jam ending ends it.
    stopJam = onJamState(jam => {
        if (jam.status !== 'live' && jam.status !== 'reconnecting') {
            leaveCall(); // eslint-disable-line no-use-before-define
            return;
        }
        const present = new Set(jam.others.map(o => o.connectionId));
        [...peers.keys()].forEach(id => {
            if (!present.has(id)) disconnect(id);
        });
        refreshPeers();
    });
    setState({joined: true, error: null, notice: null});
    publishPresence();
    send(null, {kind: 'join'});
    listDevices();
    startMeters();
};

const leaveCall = () => {
    if (!state.joined) return;
    send(null, {kind: 'bye'});
    [...peers.keys()].forEach(disconnect);
    if (audioTrack) audioTrack.stop();
    if (videoTrack) videoTrack.stop();
    audioTrack = null;
    videoTrack = null;
    micAnalyser = null;
    clearInterval(meterTimer);
    meterTimer = 0;
    if (stopEvents) stopEvents();
    if (stopJam) stopJam();
    stopEvents = null;
    stopJam = null;
    setState({joined: false, micOn: false, camOn: false, localStream: null, peers: [], speaking: [], micLevel: 0});
    publishPresence();
};

const clearCallNotice = () => setState({notice: null, error: null});

// Local testing only.
if (typeof location !== 'undefined' && location.hostname === 'localhost') {
    window.__sjCall = {getCallState, peers};
}

export {
    getCallState,
    onCallState,
    joinCall,
    leaveCall,
    setMic,
    setCamera,
    chooseMic,
    chooseCamera,
    chooseSpeaker,
    setVolume,
    setPeerVolume,
    hidePeerVideo,
    hostControl,
    clearCallNotice
};
