// Sparkjam: talking in a jam. A side panel with the call (voice and video, browser to browser) and the
// text chat. Only exists while in a jam. Mic and camera stay off until switched on.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import sj from '../sj/sj.css';
import {getJamState, onJamState, sendJamChat, markChatRead, muteInChat} from '../../lib/sj-jam';
import {
    getCallState, onCallState, joinCall, leaveCall, setMic, setCamera, chooseMic, chooseCamera, chooseSpeaker,
    setVolume, setPeerVolume, hidePeerVideo, hostControl, clearCallNotice
} from '../../lib/sj-call';
import {MAX_LENGTH} from '../../lib/sj-chat-filter';
import styles from './jam-talk.css';

const useStore = (get, subscribe) => {
    const [value, setValue] = useState(get());
    useEffect(() => subscribe(setValue), []);
    return value;
};

const Video = ({stream, mirror}) => {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
    }, [stream]);
    return (
        <video
            ref={ref}
            className={classNames(styles.video, {[styles.mirror]: mirror})}
            autoPlay
            playsInline
            muted
        />
    );
};
Video.propTypes = {stream: PropTypes.object, mirror: PropTypes.bool};

const Tile = ({name, color, video, stream, speaking, micOn, mirror, children}) => (
    <div className={classNames(styles.tile, {[styles.speaking]: speaking})}>
        {video && stream ? (
            <Video
                stream={stream}
                mirror={mirror}
            />
        ) : (
            <span
                className={styles.bigAvatar}
                style={{background: color || '#c9a7ff'}}
            >{(name || '?')[0]}</span>
        )}
        <span className={styles.tileName}>
            <i
                className={micOn ? styles.micOn : styles.micOff}
                aria-label={micOn ? 'Mic on' : 'Mic off'}
            />
            {name}
        </span>
        {children}
    </div>
);
Tile.propTypes = {
    name: PropTypes.string,
    color: PropTypes.string,
    video: PropTypes.bool,
    stream: PropTypes.object,
    speaking: PropTypes.bool,
    micOn: PropTypes.bool,
    mirror: PropTypes.bool,
    children: PropTypes.node
};

const Settings = ({call, onClose}) => (
    <div
        className={styles.settings}
        role="dialog"
        aria-label="Call settings"
    >
        <div className={styles.settingsHead}>
            <b>{'SETTINGS'}</b>
            <button
                onClick={onClose}
                aria-label="Close settings"
            >{'✕'}</button>
        </div>
        <label>
            {'Microphone'}
            <select
                value={call.micId}
                onChange={e => chooseMic(e.target.value)}
            >
                <option value="">{'Default'}</option>
                {call.devices.mics.map(d => (<option
                    key={d.id}
                    value={d.id}
                >{d.label}</option>))}
            </select>
        </label>
        <div
            className={styles.meter}
            aria-label="Microphone level"
        >
            <i style={{width: `${Math.min(100, Math.round(call.micLevel * 600))}%`}} />
        </div>
        <p className={styles.hint}>{call.micOn ? 'Talk to test your mic.' : 'Turn your mic on to test it.'}</p>
        <label>
            {'Camera'}
            <select
                value={call.camId}
                onChange={e => chooseCamera(e.target.value)}
            >
                <option value="">{'Default'}</option>
                {call.devices.cams.map(d => (<option
                    key={d.id}
                    value={d.id}
                >{d.label}</option>))}
            </select>
        </label>
        {call.devices.speakers.length && 'setSinkId' in HTMLMediaElement.prototype ? (
            <label>
                {'Speaker'}
                <select
                    value={call.speakerId}
                    onChange={e => chooseSpeaker(e.target.value)}
                >
                    <option value="">{'Default'}</option>
                    {call.devices.speakers.map(d => (<option
                        key={d.id}
                        value={d.id}
                    >{d.label}</option>))}
                </select>
            </label>
        ) : null}
        <label>
            {`Volume ${Math.round(call.volume * 100)}%`}
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={call.volume}
                onChange={e => setVolume(Number(e.target.value))}
            />
        </label>
    </div>
);
Settings.propTypes = {call: PropTypes.object.isRequired, onClose: PropTypes.func.isRequired};

const REPORT_REASONS = [
    ['mean', 'Being mean or bullying'],
    ['rude', 'Rude or upsetting words'],
    ['personal-info', 'Asking for personal details'],
    ['uncomfortable', 'Made me feel uncomfortable'],
    ['other', 'Something else']
];

const ReportDialog = ({person, jam, onClose}) => {
    const [reason, setReason] = useState('');
    const [details, setDetails] = useState('');
    const [state, setStateValue] = useState('form');
    const submit = async e => {
        e.preventDefault();
        setStateValue('sending');
        try {
            const response = await fetch(`${process.env.ROOT || '/'}api/jam-report`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({
                    code: jam.code,
                    reason,
                    details,
                    reportedId: person.userId,
                    reportedName: person.name,
                    messages: jam.chat.map(m => ({name: m.name, text: m.text, at: m.at}))
                })
            });
            if (!response.ok) throw new Error('report failed');
            setStateValue('sent');
            muteInChat(person.userId);
        } catch (err) {
            setStateValue('failed');
        }
    };
    return (
        <div
            className={classNames(sj.tokens, styles.backdrop)}
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <form
                className={styles.report}
                onSubmit={submit}
                role="dialog"
                aria-label={`Report ${person.name}`}
            >
                <h2>{`REPORT ${String(person.name).toUpperCase()}`}</h2>
                {state === 'sent' ? (
                    <React.Fragment>
                        <p>{'Thanks for telling us. We\'ve hidden their messages for you.'}</p>
                        <p>{'If you feel worried, leave the jam and tell a grown-up you trust.'}</p>
                        <button
                            className={sj.btn}
                            type="button"
                            onClick={onClose}
                        >{'OK'}</button>
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <p>{'What happened? We\'ll send the recent chat with your report.'}</p>
                        {REPORT_REASONS.map(([value, label]) => (
                            <label
                                key={value}
                                className={styles.reason}
                            >
                                <input
                                    type="radio"
                                    name="reason"
                                    value={value}
                                    checked={reason === value}
                                    onChange={() => setReason(value)}
                                />
                                {label}
                            </label>
                        ))}
                        <textarea
                            value={details}
                            onChange={e => setDetails(e.target.value)}
                            maxLength={500}
                            placeholder="Anything else? (optional)"
                            aria-label="More details"
                        />
                        {state === 'failed' ? (
                            <p
                                className={styles.error}
                                role="alert"
                            >{'That didn\'t send. Try again, or leave the jam and tell a grown-up.'}</p>
                        ) : null}
                        <div className={styles.row}>
                            <button
                                className={sj.btn}
                                type="submit"
                                disabled={!reason || state === 'sending'}
                            >{state === 'sending' ? 'SENDING…' : 'SEND REPORT'}</button>
                            <button
                                className={classNames(sj.btn, sj.btnGhost)}
                                type="button"
                                onClick={onClose}
                            >{'CANCEL'}</button>
                        </div>
                    </React.Fragment>
                )}
            </form>
        </div>
    );
};
ReportDialog.propTypes = {
    person: PropTypes.object.isRequired,
    jam: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired
};

/**
 * The jam's talk panel: call plus chat.
 * @param {object} props Props.
 * @param {Function} props.onClose Close the panel.
 * @returns {React.ReactElement} The panel.
 */
const JamTalk = ({onClose}) => {
    const jam = useStore(getJamState, onJamState);
    const call = useStore(getCallState, onCallState);
    const [draft, setDraft] = useState('');
    const [problem, setProblem] = useState('');
    const [settings, setSettings] = useState(false);
    const [report, setReport] = useState(null);
    const listRef = useRef(null);
    const isHost = jam.jam && jam.jam.isHost;

    useEffect(() => {
        markChatRead();
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [jam.chat.length]);

    const send = e => {
        e.preventDefault();
        const result = sendJamChat(draft);
        if (result.ok) {
            setDraft('');
            setProblem('');
        } else if (result.reason) {
            setProblem(result.reason);
        }
    };

    const self = jam.self || {};
    return (
        <aside
            className={classNames(sj.tokens, styles.panel)}
            aria-label="Jam chat and call"
        >
            <div className={styles.head}>
                <h2>{'TALK'}</h2>
                <button
                    className={styles.close}
                    onClick={onClose}
                    aria-label="Close chat"
                >{'✕'}</button>
            </div>

            <section
                className={styles.call}
                aria-label="Call"
            >
                {call.joined ? (
                    <React.Fragment>
                        <div className={styles.controls}>
                            <button
                                className={classNames(styles.control, {[styles.on]: call.micOn})}
                                onClick={() => setMic(!call.micOn)}
                                aria-pressed={call.micOn}
                            >{call.micOn ? '🎙 MIC ON' : '🎙 MIC OFF'}</button>
                            <button
                                className={classNames(styles.control, {[styles.on]: call.camOn})}
                                onClick={() => setCamera(!call.camOn)}
                                aria-pressed={call.camOn}
                            >{call.camOn ? '📷 CAM ON' : '📷 CAM OFF'}</button>
                            <button
                                className={styles.control}
                                onClick={() => setSettings(!settings)}
                                aria-expanded={settings}
                                aria-label="Call settings"
                            >{'⚙'}</button>
                            <button
                                className={classNames(styles.control, styles.leave)}
                                onClick={leaveCall}
                            >{'LEAVE'}</button>
                        </div>
                        {settings ? <Settings
                            call={call}
                            onClose={() => setSettings(false)}
                        /> : null}
                        <div className={styles.tiles}>
                            <Tile
                                name={`${self.name || 'You'} (you)`}
                                color={self.color}
                                video={call.camOn}
                                stream={call.localStream}
                                speaking={call.speaking.includes('me')}
                                micOn={call.micOn}
                                mirror
                            />
                            {call.peers.map(peer => (
                                <Tile
                                    key={peer.connectionId}
                                    name={peer.name}
                                    color={peer.color}
                                    video={peer.camOn && !peer.hidden}
                                    stream={peer.stream}
                                    speaking={call.speaking.includes(peer.connectionId)}
                                    micOn={peer.micOn}
                                >
                                    <div className={styles.tileTools}>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={peer.volume}
                                            onChange={e => setPeerVolume(peer.connectionId, Number(e.target.value))}
                                            aria-label={`${peer.name}'s volume`}
                                        />
                                        {peer.camOn ? (
                                            <button
                                                onClick={() => hidePeerVideo(peer.connectionId, !peer.hidden)}
                                            >{peer.hidden ? 'SHOW' : 'HIDE'}</button>
                                        ) : null}
                                        {isHost && peer.micOn ? (
                                            <button
                                                onClick={() => hostControl(peer.connectionId, 'mute')}
                                                title="Turn their mic off"
                                            >{'MUTE'}</button>
                                        ) : null}
                                        {isHost && peer.camOn ? (
                                            <button
                                                onClick={() => hostControl(peer.connectionId, 'camera-off')}
                                                title="Turn their camera off"
                                            >{'CAM OFF'}</button>
                                        ) : null}
                                    </div>
                                </Tile>
                            ))}
                        </div>
                        {call.peers.length ? null : (
                            <p className={styles.hint}>{'Nobody else is in the call yet.'}</p>
                        )}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <button
                            className={classNames(sj.btn, sj.btnCyan, sj.btnWide)}
                            onClick={joinCall}
                        >{'🎧 JOIN THE CALL'}</button>
                        <p className={styles.hint}>
                            {`${jam.others.filter(o => o.inCall).length} in the call. ` +
                                'Your mic and camera stay off until you turn them on.'}
                        </p>
                    </React.Fragment>
                )}
                {call.error || call.notice ? (
                    <p
                        className={styles.notice}
                        role="alert"
                    >
                        {call.error || call.notice}
                        <button
                            onClick={clearCallNotice}
                            aria-label="Dismiss"
                        >{'✕'}</button>
                    </p>
                ) : null}
            </section>

            <section
                className={styles.chat}
                aria-label="Chat"
            >
                <div
                    ref={listRef}
                    className={styles.messages}
                    aria-live="polite"
                >
                    <p className={styles.rules}>
                        {'Be kind. Never share your real name, address, school, phone number or other apps.'}
                    </p>
                    {jam.chat.map(message => (
                        <div
                            key={message.id}
                            className={classNames(styles.message, {[styles.mine]: message.mine})}
                        >
                            <b style={{color: message.color || '#c9a7ff'}}>{message.mine ? 'You' : message.name}</b>
                            <span>{message.text}</span>
                            {message.mine ? null : (
                                <span className={styles.messageTools}>
                                    <button
                                        onClick={() => muteInChat(message.userId)}
                                        title={`Hide ${message.name}'s messages`}
                                    >{'MUTE'}</button>
                                    <button
                                        onClick={() => setReport({userId: message.userId, name: message.name})}
                                    >{'REPORT'}</button>
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                {problem ? (
                    <p
                        className={styles.error}
                        role="alert"
                    >{problem}</p>
                ) : null}
                <form
                    className={styles.compose}
                    onSubmit={send}
                >
                    <input
                        value={draft}
                        onChange={e => {
                            setDraft(e.target.value);
                            setProblem('');
                        }}
                        onKeyDown={e => e.stopPropagation()}
                        maxLength={MAX_LENGTH}
                        placeholder="Say something…"
                        aria-label="Chat message"
                    />
                    <button
                        className={classNames(sj.btn, sj.btnSm)}
                        type="submit"
                        disabled={!draft.trim()}
                    >{'SEND'}</button>
                </form>
            </section>
            {report ? (
                <ReportDialog
                    person={report}
                    jam={jam}
                    onClose={() => setReport(null)}
                />
            ) : null}
        </aside>
    );
};
JamTalk.propTypes = {onClose: PropTypes.func.isRequired};

/**
 * The chat button for the menu bar, with unread messages and how many are in the call.
 * @param {object} props Props.
 * @param {Function} props.onClick Open the panel.
 * @param {boolean} props.open Whether the panel is open.
 * @returns {React.ReactElement} The button.
 */
const TalkButton = ({onClick, open}) => {
    const jam = useStore(getJamState, onJamState);
    const call = useStore(getCallState, onCallState);
    const inCall = jam.others.filter(o => o.inCall).length + (call.joined ? 1 : 0);
    return (
        <button
            className={classNames(styles.talkButton, {[styles.talkOpen]: open})}
            onClick={onClick}
            aria-expanded={open}
            aria-label={`Chat and call${jam.unread ? `, ${jam.unread} new messages` : ''}`}
        >
            {'💬'}
            {inCall ? <span className={styles.inCall}>{`🎧${inCall}`}</span> : null}
            {jam.unread && !open ? <span className={styles.badge}>{jam.unread > 9 ? '9+' : jam.unread}</span> : null}
        </button>
    );
};
TalkButton.propTypes = {onClick: PropTypes.func.isRequired, open: PropTypes.bool};

export {JamTalk, TalkButton};
