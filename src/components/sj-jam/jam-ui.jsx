// Sparkjam: jam screens in the editor (designs J1, J3, J4). The menu bar's jam controls (start, live
// badge, code, people, invite), the invite dialog, the people panel, live cursors and activity notes.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {connect} from 'react-redux';
import qrcode from 'qrcode-generator';
import {Lumi} from '../sj/pixel-art.jsx';
import sj from '../sj/sj.css';
import {openAccountDialog, useAccount} from '../sj/account.jsx';
import {startAuth, onAccount, isAccountReady} from '../../lib/sj-auth';
import {
    saveForJam, joinJam, leaveJam, getJamState, onJamState, broadcastJam, setJamTab, setJamCursor
} from '../../lib/sj-jam';
import {startJam, getJam, removeFromJam, endJam, jamLink, parseJamCode} from '../../lib/sj-jam-api';
import {links} from '../../lib/sj-links';
import {getIsShowingProject} from '../../reducers/project-state';
import styles from './jam-ui.css';

const useJam = () => {
    const [jam, setJam] = useState(getJamState());
    useEffect(() => onJamState(setJam), []);
    return jam;
};

const params = () => new URLSearchParams(location.search);

const setJamParam = code => {
    const next = params();
    ['jam', 'startjam'].forEach(name => next.delete(name));
    if (code) next.set('jam', code);
    const search = next.toString();
    history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
};

// Wait until there's a finished account, asking for one if needed.
const whenAccountReady = async reason => {
    const account = await startAuth();
    if (isAccountReady(account)) return true;
    openAccountDialog(reason);
    return new Promise(resolve => {
        const stop = onAccount(next => {
            if (isAccountReady(next)) {
                stop();
                resolve(true);
            }
        });
    });
};

const Avatar = ({name, color, small}) => (
    <span
        className={classNames(styles.avatar, {[styles.avatarSmall]: small})}
        style={{background: color || '#c9a7ff'}}
        title={name}
    >{(name || '?')[0]}</span>
);
Avatar.propTypes = {name: PropTypes.string, color: PropTypes.string, small: PropTypes.bool};

const QrCode = ({text}) => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const cells = [];
    for (let y = 0; y < count; y++) {
        for (let x = 0; x < count; x++) {
            if (qr.isDark(y, x)) {
                cells.push(<rect
                    key={`${x},${y}`}
                    x={x}
                    y={y}
                    width="1.02"
                    height="1.02"
                />);
            }
        }
    }
    return (
        <svg
            className={styles.qr}
            viewBox={`-2 -2 ${count + 4} ${count + 4}`}
            shapeRendering="crispEdges"
            role="img"
            aria-label="QR code for the jam link"
        >
            <rect
                x="-2"
                y="-2"
                width={count + 4}
                height={count + 4}
                fill="#fff"
            />
            <g fill="#14001f">{cells}</g>
        </svg>
    );
};
QrCode.propTypes = {text: PropTypes.string.isRequired};

const Modal = ({label, onClose, children, wide}) => {
    const ref = useRef(null);
    useEffect(() => {
        const onKey = e => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const first = ref.current && ref.current.querySelector('button, a, input');
        if (first) first.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div
            className={classNames(sj.tokens, styles.backdrop)}
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={ref}
                className={classNames(styles.modal, {[styles.wide]: wide})}
                role="dialog"
                aria-modal="true"
                aria-label={label}
            >
                {children}
            </div>
        </div>
    );
};
Modal.propTypes = {label: PropTypes.string, onClose: PropTypes.func, children: PropTypes.node, wide: PropTypes.bool};

// J1: the jam is live; invite friends.
const InviteDialog = ({code, onClose}) => {
    const link = jamLink(code);
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            window.prompt('Copy this link', link); // eslint-disable-line no-alert
        }
    };
    const share = async () => {
        if (navigator.share) {
            try {
                await navigator.share({title: 'Join my Sparkjam jam', text: `Jam code JAM-${code}`, url: link});
                return;
            } catch (e) {
                // Cancelled: fall back to copying.
            }
        }
        copy();
    };
    return (
        <Modal
            label="Invite friends to your jam"
            onClose={onClose}
            wide
        >
            <div className={styles.head}>
                <Lumi
                    arms="wave"
                    eyes="happy"
                    px={4}
                />
                <h2 className={styles.liveTitle}>{'YOUR JAM IS LIVE!'}</h2>
                <button
                    className={styles.close}
                    onClick={onClose}
                    aria-label="Close"
                >{'✕'}</button>
            </div>
            <div className={styles.inviteBody}>
                <QrCode text={link} />
                <div className={styles.inviteInfo}>
                    <span className={styles.label}>{'JAM CODE'}</span>
                    <span className={styles.bigCode}>{`JAM-${code}`}</span>
                    <div className={styles.linkRow}>
                        <input
                            readOnly
                            value={link}
                            aria-label="Jam link"
                            onFocus={e => e.target.select()}
                        />
                        <button onClick={copy}>{copied ? 'COPIED' : 'COPY'}</button>
                    </div>
                </div>
            </div>
            <div className={styles.actions}>
                <button
                    className={classNames(sj.btn, styles.grow)}
                    onClick={share}
                >{'SHARE INVITE'}</button>
                <button
                    className={classNames(sj.btn, sj.btnGhost)}
                    onClick={onClose}
                >{'DONE'}</button>
            </div>
            <p className={styles.note}>
                {'Invite-only: only people with this code or link can join, and they need a Sparkjam account. ' +
                    'You can remove anyone. The code stops working when you end the jam.'}
            </p>
        </Modal>
    );
};
InviteDialog.propTypes = {code: PropTypes.string.isRequired, onClose: PropTypes.func.isRequired};

// J4: who's in the jam.
const PeoplePanel = ({jam, vm, onInvite, onClose}) => {
    const [busy, setBusy] = useState('');
    const [confirmEnd, setConfirmEnd] = useState(false);
    const isHost = jam.jam && jam.jam.isHost;
    const follow = person => {
        if (!person.target) return;
        const target = person.target === '__stage__' ? vm.runtime.getTargetForStage() :
            vm.runtime.getSpriteTargetByName(person.target);
        if (target) vm.setEditingTarget(target.id);
        onClose();
    };
    const remove = async person => {
        setBusy(person.connectionId);
        try {
            await removeFromJam(jam.code, person.id);
            broadcastJam({type: 'kick', userId: person.id});
        } catch (e) {
            window.alert(e.message); // eslint-disable-line no-alert
        }
        setBusy('');
    };
    const end = async () => {
        setBusy('end');
        try {
            await endJam(jam.code);
            broadcastJam({type: 'ended'});
            leaveJam();
            setJamParam(null);
        } catch (e) {
            window.alert(e.message); // eslint-disable-line no-alert
            setBusy('');
        }
    };
    const where = person => {
        if (!person.target) return '';
        const place = person.target === '__stage__' ? 'Stage' : person.target;
        const tab = {costumes: 'Costumes', sounds: 'Sounds'}[person.tab] || 'Code';
        return `${place}, ${tab}`;
    };
    const self = jam.self;
    return (
        <div
            className={classNames(sj.tokens, styles.panel)}
            role="dialog"
            aria-label="People in this jam"
        >
            <div className={styles.panelHead}>
                <h2>{`IN THIS JAM · ${jam.others.length + 1}`}</h2>
                <button
                    className={styles.close}
                    onClick={onClose}
                    aria-label="Close"
                >{'✕'}</button>
            </div>
            {self ? (
                <div className={styles.person}>
                    <Avatar
                        name={self.name}
                        color={self.color}
                    />
                    <div>
                        <b>{`${self.name} (you)`}</b>
                        <span>{isHost ? 'Started the jam' : 'Can edit'}</span>
                    </div>
                </div>
            ) : null}
            {jam.others.map(person => (
                <div
                    key={person.connectionId}
                    className={styles.person}
                >
                    <Avatar
                        name={person.name}
                        color={person.color}
                    />
                    <div>
                        <b>{person.name}</b>
                        <span>{[person.host ? 'Started the jam' : 'Can edit', where(person)].filter(Boolean)
                            .join(' · ')}</span>
                    </div>
                    <div className={styles.personActions}>
                        <button
                            onClick={() => follow(person)}
                            disabled={!person.target}
                        >{'FOLLOW'}</button>
                        {isHost && !person.host ? (
                            <button
                                className={styles.danger}
                                onClick={() => remove(person)}
                                disabled={busy === person.connectionId}
                            >{'REMOVE'}</button>
                        ) : null}
                    </div>
                </div>
            ))}
            {jam.others.length ? null : (
                <p className={styles.empty}>{'Nobody else is here yet. Send them the invite!'}</p>
            )}
            <div className={styles.panelFoot}>
                <button
                    className={classNames(sj.btn, sj.btnSm)}
                    onClick={onInvite}
                >{'+ INVITE'}</button>
                {isHost ? (
                    confirmEnd ? (
                        <span className={styles.confirm}>
                            {'End for everyone? '}
                            <button
                                className={styles.danger}
                                onClick={end}
                                disabled={busy === 'end'}
                            >{'YES, END IT'}</button>
                            <button onClick={() => setConfirmEnd(false)}>{'NO'}</button>
                        </span>
                    ) : (
                        <button
                            className={classNames(sj.btn, sj.btnSm, sj.btnGhost)}
                            onClick={() => setConfirmEnd(true)}
                        >{'END JAM'}</button>
                    )
                ) : (
                    <button
                        className={classNames(sj.btn, sj.btnSm, sj.btnGhost)}
                        onClick={() => {
                            leaveJam();
                            setJamParam(null);
                        }}
                    >{'LEAVE'}</button>
                )}
            </div>
        </div>
    );
};
PeoplePanel.propTypes = {
    jam: PropTypes.object.isRequired,
    vm: PropTypes.object.isRequired,
    onInvite: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

/**
 * The jam controls in the editor's menu bar, plus joining from ?jam=CODE and starting from ?startjam.
 * @returns {React.ReactElement} The controls.
 */
const JamControlsComponent = ({vm, projectTitle, isShowingProject, activeTab}) => {
    const jam = useJam();
    useAccount();
    const [invite, setInvite] = useState(false);
    const [people, setPeople] = useState(false);
    const [starting, setStarting] = useState(false);
    const [problem, setProblem] = useState('');
    const autoDone = useRef(false);

    const start = async () => {
        setProblem('');
        if (!(await whenAccountReady('jam'))) return;
        setStarting(true);
        try {
            const sb3 = await saveForJam(vm);
            const started = await startJam(sb3, projectTitle);
            setJamParam(started.code);
            await joinJam(vm, started, {needsGame: false});
            setInvite(true);
        } catch (e) {
            setProblem(e.message);
        }
        setStarting(false);
    };

    // Joining from a link, or starting straight away from "Jam on this game".
    useEffect(() => {
        if (!isShowingProject || autoDone.current) return;
        const code = parseJamCode(params().get('jam') || '');
        const wantsStart = params().has('startjam');
        if (!code && !wantsStart) return;
        autoDone.current = true;
        (async () => {
            if (!(await whenAccountReady('jam'))) return;
            if (wantsStart) {
                start();
                return;
            }
            try {
                const found = await getJam(code);
                await joinJam(vm, found, {needsGame: true});
            } catch (e) {
                setProblem(e.message);
                setJamParam(null);
            }
        })();
    }, [isShowingProject]);

    useEffect(() => {
        setJamTab(['code', 'costumes', 'sounds'][activeTab] || 'code');
    }, [activeTab, jam.status]);

    const live = jam.status === 'live' || jam.status === 'reconnecting';
    // While jamming, the menu bar makes room for the jam controls (see jam-ui.css).
    useEffect(() => {
        document.body.classList.toggle('sj-jamming', live);
    }, [live]);
    let controls;
    if (jam.status === 'joining') {
        controls = <span className={styles.pill}>{'JOINING JAM…'}</span>;
    } else if (live) {
        const everyone = [jam.self, ...jam.others].filter(Boolean);
        controls = (
            <React.Fragment>
                <span className={classNames(styles.pill, styles.livePill)}>
                    <i aria-hidden="true" />
                    {jam.status === 'reconnecting' ? 'RECONNECTING…' : 'LIVE JAM'}
                </span>
                <button
                    className={styles.codeChip}
                    onClick={() => setInvite(true)}
                    title="Show the invite"
                >{`JAM-${jam.code}`}</button>
                <button
                    className={styles.avatars}
                    onClick={() => setPeople(!people)}
                    aria-label={`People in this jam: ${everyone.length}`}
                    aria-expanded={people}
                >
                    {everyone.slice(0, 4).map(p => (
                        <Avatar
                            key={p.connectionId}
                            name={p.name}
                            color={p.color}
                            small
                        />
                    ))}
                    {everyone.length > 4 ? <span className={styles.more}>{`+${everyone.length - 4}`}</span> : null}
                </button>
                <button
                    className={styles.invite}
                    onClick={() => setInvite(true)}
                >{'INVITE'}</button>
            </React.Fragment>
        );
    } else {
        controls = (
            <button
                className={styles.start}
                onClick={start}
                disabled={starting}
            >{starting ? 'STARTING…' : '▶ START A JAM'}</button>
        );
    }

    const ended = jam.status === 'ended' || jam.status === 'error';
    return (
        <div className={classNames(sj.tokens, styles.controls)}>
            {controls}
            {invite && live ? (
                <InviteDialog
                    code={jam.code}
                    onClose={() => setInvite(false)}
                />
            ) : null}
            {people && live ? (
                <PeoplePanel
                    jam={jam}
                    vm={vm}
                    onInvite={() => {
                        setPeople(false);
                        setInvite(true);
                    }}
                    onClose={() => setPeople(false)}
                />
            ) : null}
            {ended || problem ? (
                <Modal
                    label="Jam"
                    onClose={() => {
                        setProblem('');
                        leaveJam();
                        setJamParam(null);
                    }}
                >
                    <div className={styles.head}>
                        <Lumi
                            eyes={jam.status === 'ended' ? 'wink' : 'sad'}
                            px={4}
                        />
                        <p className={styles.say}>{problem || jam.error || 'The jam has ended.'}</p>
                    </div>
                    <p className={styles.note}>
                        {jam.status === 'ended' ?
                            'Your copy of the game is still here, and saved in My games.' :
                            'You can keep making on your own. Check the code, or ask for a new invite.'}
                    </p>
                    <div className={styles.actions}>
                        <button
                            className={sj.btn}
                            onClick={() => {
                                setProblem('');
                                leaveJam();
                                setJamParam(null);
                            }}
                        >{'KEEP MAKING'}</button>
                        <a
                            className={classNames(sj.btn, sj.btnGhost)}
                            href={links.myGames}
                        >{'MY GAMES'}</a>
                    </div>
                </Modal>
            ) : null}
        </div>
    );
};
JamControlsComponent.propTypes = {
    activeTab: PropTypes.number,
    isShowingProject: PropTypes.bool,
    projectTitle: PropTypes.string,
    vm: PropTypes.object.isRequired
};

const JamControls = connect(state => ({
    activeTab: state.scratchGui.editorTab.activeTabIndex,
    isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
    projectTitle: state.scratchGui.projectTitle,
    vm: state.scratchGui.vm
}))(JamControlsComponent);

/**
 * Other people's cursors in the code area, and recent activity. Also sends my cursor position.
 * @returns {?React.ReactElement} The overlay.
 */
const JamOverlayComponent = ({vm, activeTab}) => {
    const jam = useJam();
    const [, setFrame] = useState(0);
    const live = jam.status === 'live' || jam.status === 'reconnecting';
    const workspace = () => window.ScratchBlocks && window.ScratchBlocks.getMainWorkspace &&
        window.ScratchBlocks.getMainWorkspace();

    // Send my cursor, in code-area coordinates so it lands on the same blocks for everyone.
    useEffect(() => {
        if (!live) return;
        const onMove = e => {
            const ws = workspace();
            if (!ws || activeTab !== 0) return;
            const svg = ws.getParentSvg();
            const canvas = ws.getCanvas();
            const box = svg.getBoundingClientRect();
            if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) {
                setJamCursor(null);
                return;
            }
            const matrix = canvas.getScreenCTM();
            if (!matrix) return;
            const point = svg.createSVGPoint();
            point.x = e.clientX;
            point.y = e.clientY;
            const local = point.matrixTransform(matrix.inverse());
            setJamCursor({x: Math.round(local.x), y: Math.round(local.y)});
        };
        document.addEventListener('pointermove', onMove);
        return () => document.removeEventListener('pointermove', onMove);
    }, [live, activeTab]);

    // Redraw cursors as the code area scrolls and zooms.
    useEffect(() => {
        if (!live || !jam.others.length) return;
        let raf = 0;
        const tick = () => {
            setFrame(f => (f + 1) % 1000000);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [live, jam.others.length]);

    if (!live) return null;
    const ws = workspace();
    const editing = vm.editingTarget ? (vm.editingTarget.isStage ? '__stage__' : vm.editingTarget.getName()) : null;
    const cursors = [];
    if (ws && activeTab === 0) {
        const svg = ws.getParentSvg();
        const matrix = ws.getCanvas().getScreenCTM();
        const box = svg.getBoundingClientRect();
        jam.others.forEach(person => {
            if (!person.cursor || person.tab !== 'code' || person.target !== editing || !matrix) return;
            const point = svg.createSVGPoint();
            point.x = person.cursor.x;
            point.y = person.cursor.y;
            const screen = point.matrixTransform(matrix);
            if (screen.x < box.left || screen.x > box.right || screen.y < box.top || screen.y > box.bottom) return;
            cursors.push(
                <div
                    key={person.connectionId}
                    className={styles.cursor}
                    style={{left: screen.x, top: screen.y}}
                    aria-hidden="true"
                >
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 10 10"
                        shapeRendering="crispEdges"
                    >
                        <path
                            d="M0 0h2v1h1v1h1v1h1v1h1v1h1v1h-3v1h1v2h-2v-2h-1v1h-1v1h-1z"
                            fill={person.color}
                            stroke="#14001f"
                            strokeWidth="0.4"
                        />
                    </svg>
                    <b style={{background: person.color}}>{person.name}</b>
                </div>
            );
        });
    }
    return (
        <div className={sj.tokens}>
            {cursors}
            {jam.activity.length ? (
                <div
                    className={styles.activity}
                    aria-live="polite"
                >
                    {jam.activity.map(item => <p key={item.id}>{item.text}</p>)}
                </div>
            ) : null}
        </div>
    );
};
JamOverlayComponent.propTypes = {
    activeTab: PropTypes.number,
    vm: PropTypes.object.isRequired
};

const JamOverlay = connect(state => ({
    activeTab: state.scratchGui.editorTab.activeTabIndex,
    vm: state.scratchGui.vm
}))(JamOverlayComponent);

export {JamControls, JamOverlay};
