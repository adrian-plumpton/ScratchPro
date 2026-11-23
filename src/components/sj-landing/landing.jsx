// Sparkjam: the landing page (/). It says what Sparkjam is, gets people making or playing in one
// tap, and sells jams. It loads no game engine, so it is quick on phones.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.
/* eslint-disable max-len */ // Long marketing copy reads better unbroken.

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from '../sj/pixel-art.jsx';
import {SiteNav, SiteFooter, GameCard, useSoon, JamCodeField, styles as sj} from '../sj/site.jsx';
import {SAMPLE_GAMES} from '../../lib/sample-games';
import {links} from '../../lib/sj-links';
import styles from './landing.css';

const Cursor = ({x, y, name, color}) => (
    <div
        className={styles.cursor}
        style={{left: x, top: y}}
    >
        <svg
            width="20"
            height="20"
            viewBox="0 0 10 10"
            shapeRendering="crispEdges"
        >
            <path
                d="M0 0h2v1h1v1h1v1h1v1h1v1h1v1h-3v1h1v2h-2v-2h-1v1h-1v1h-1z"
                fill={color}
            />
        </svg>
        <b style={{background: color}}>{name}</b>
    </div>
);
Cursor.propTypes = {
    x: PropTypes.number,
    y: PropTypes.number,
    name: PropTypes.string,
    color: PropTypes.string
};

// The hero picture: a live jam in the editor, and the same game on a phone.
const Studio = () => (
    <div
        className={styles.studio}
        aria-hidden="true"
    >
        <div className={styles.win}>
            <div className={styles.bar}>
                <i style={{background: 'var(--pink)'}} />
                <i style={{background: 'var(--yellow)'}} />
                <i style={{background: 'var(--cyan)'}} />
                {'SPARK HOP · LIVE JAM'}
                <div className={styles.who}>
                    <span style={{background: 'var(--pink)'}}>{'P1'}</span>
                    <span style={{background: 'var(--cyan)'}}>{'P2'}</span>
                    <span style={{background: 'var(--yellow)'}}>{'P3'}</span>
                </div>
            </div>
            <div className={styles.winBody}>
                <div className={styles.codeArea}>
                    <div className={styles.blocks}>
                        <div style={{background: 'var(--yellow)'}}>{'WHEN GAME STARTS'}</div>
                        <div style={{background: 'var(--lav)'}}>{'FOREVER'}</div>
                        <div style={{background: 'var(--cyan)', marginLeft: 18}}>{'IF JOYSTICK MOVED'}</div>
                        <div style={{background: 'var(--pink)', color: '#fff', marginLeft: 36}}>{'MOVE 6 STEPS'}</div>
                        <div style={{background: 'var(--cyan)', marginLeft: 18}}>{'IF SPACE PRESSED'}</div>
                        <div style={{background: 'var(--pink)', color: '#fff', marginLeft: 36}}>{'JUMP 13'}</div>
                    </div>
                    <Cursor
                        x={150}
                        y={120}
                        name="LEO"
                        color="var(--cyan)"
                    />
                    <div className={styles.sticky}>{'jump higher?'}</div>
                </div>
                <div className={styles.winStage}>
                    <img
                        src={links.thumbnail('spark-hop')}
                        alt=""
                    />
                    <div className={styles.winPlay}>
                        <span>{'▶ PLAY'}</span>
                        <span style={{background: 'var(--lav)'}}>{'PHONE VIEW'}</span>
                    </div>
                    <Cursor
                        x={150}
                        y={60}
                        name="MAYA"
                        color="var(--pink)"
                    />
                </div>
            </div>
        </div>
        <div className={styles.phone}>
            <img
                src={links.thumbnail('spark-hop')}
                alt=""
            />
            <div className={styles.joy}><i /></div>
            <div
                className={styles.abtn}
                style={{right: '15%', bottom: '11%', width: '7%', background: 'var(--cyan)'}}
            >{'X'}</div>
            <div
                className={styles.abtn}
                style={{right: '4%', bottom: '24%', width: '8.5%', background: 'var(--yellow)'}}
            >{'SPACE'}</div>
        </div>
        <div className={styles.heroLumi}>
            <Lumi
                arms="wave"
                px={6}
            />
        </div>
    </div>
);

const QR_CELLS = [
    [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [5, 0], [6, 0], [7, 0], [5, 1], [7, 1],
    [5, 2], [6, 2], [7, 2], [0, 5], [1, 5], [2, 5], [0, 6], [2, 6], [0, 7], [1, 7], [2, 7], [4, 4], [5, 5],
    [7, 5], [4, 6], [6, 6], [5, 7], [7, 7], [4, 1], [3, 3], [6, 4]
];

const Landing = () => {
    const [soonDialog, soon] = useSoon();
    return (
        <div className={classNames(sj.page, styles.landing)}>
            <header className={styles.hero}>
                <SiteNav
                    active="home"
                    clear
                    onSoon={soon}
                />
                <div
                    className={styles.hud}
                    aria-hidden="true"
                >
                    <span>{'1UP '}<b>{'000000'}</b></span>
                    <span>{'HI-SCORE '}<b>{'012800'}</b></span>
                    <span>{'CREDITS '}<b>{'FREE PLAY'}</b></span>
                </div>
                <div className={styles.heroGrid}>
                    <div>
                        <p className={styles.eyebrow}>{'A TINY GAME STUDIO IN YOUR BROWSER'}</p>
                        <h1 className={styles.h1}>
                            {'Make games with friends. '}
                            <em>{'Play them anywhere.'}</em>
                        </h1>
                        <p className={styles.lede}>
                            {'Snap blocks together, jam on the same game live, and play it on any phone with ' +
                                'a joystick and buttons that set themselves up.'}
                        </p>
                        <div className={styles.ctas}>
                            <a
                                className={sj.btn}
                                href={links.newGame}
                            >{'▶ START MAKING'}</a>
                            <JamCodeField
                                id="jam-code-hero"
                                onSoon={soon}
                            />
                        </div>
                        <p className={styles.small}>
                            {'Free. No account needed to start making. '}
                            <a href={links.sample('spark-hop')}>{'Or play a game first →'}</a>
                        </p>
                    </div>
                    <Studio />
                </div>
            </header>

            <main>
                <section
                    className={classNames(styles.section, styles.jam)}
                    id="jam"
                    aria-labelledby="jam-title"
                >
                    <p className={styles.kicker}>{'JAM MODE'}</p>
                    <h2
                        className={styles.h2}
                        id="jam-title"
                    >
                        {'Like a whiteboard, '}
                        <em>{'but for making games.'}</em>
                    </h2>
                    <p className={styles.secLede}>
                        {'Start a jam from any game and your friends are in it seconds later, building, ' +
                            'testing and joking around on the same game in real time.'}
                    </p>
                    <div className={styles.steps}>
                        <div className={styles.step}>
                            <span className={styles.stepN}>{'1 · START'}</span>
                            <h3>{'One tap to open a jam'}</h3>
                            <p>{'Every game has a Jam button. Press it and your game goes live.'}</p>
                            <div className={styles.stepArt}>
                                <a
                                    className={classNames(sj.btn, sj.btnCyan)}
                                    href={links.jamOnSample('spark-hop')}
                                >{'▶ START A JAM'}</a>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepN}>{'2 · INVITE'}</span>
                            <h3>{'Share a code, a link or a QR'}</h3>
                            <p>{'Friends join from a phone, a tablet or a school laptop. Invite-only, always.'}</p>
                            <div className={styles.stepArt}>
                                <div className={styles.invite}>
                                    <svg
                                        className={styles.qr}
                                        viewBox="0 0 8 8"
                                        shapeRendering="crispEdges"
                                        aria-hidden="true"
                                    >
                                        {QR_CELLS.map(([x, y]) => (
                                            <rect
                                                key={`${x},${y}`}
                                                x={x}
                                                y={y}
                                                width="1"
                                                height="1"
                                                fill="#fff"
                                            />
                                        ))}
                                    </svg>
                                    <div>
                                        <div className={styles.inviteLabel}>{'JAM CODE'}</div>
                                        <div className={styles.inviteCode}>{'JAM-4827'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className={styles.step}>
                            <span className={styles.stepN}>{'3 · BUILD'}</span>
                            <h3>{'Build together, live'}</h3>
                            <p>{'See everyone\'s cursor, follow a friend, leave sticky notes, play the latest version.'}</p>
                            <div className={styles.stepArt}>
                                <div className={styles.people}>
                                    <span style={{background: 'var(--pink)'}}>{'MAYA'}</span>
                                    <span style={{background: 'var(--cyan)'}}>{'LEO'}</span>
                                    <span style={{background: 'var(--yellow)'}}>{'PRIYA'}</span>
                                    <span style={{background: 'var(--lav)'}}>{'+ YOU'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section
                    className={classNames(styles.section, styles.games)}
                    aria-labelledby="games-title"
                >
                    <div className={styles.gamesHead}>
                        <div>
                            <p className={styles.kicker}>{'SAMPLE GAMES'}</p>
                            <h2
                                className={styles.h2}
                                id="games-title"
                            >{'Press start on a sample.'}</h2>
                        </div>
                        <a
                            className={styles.allGames}
                            href={links.games}
                        >{'All games →'}</a>
                    </div>
                    <div className={sj.cards}>
                        {SAMPLE_GAMES.map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                showText={false}
                            />
                        ))}
                    </div>
                    <div className={styles.lumiRow}>
                        <div className={styles.lumiRowArt}>
                            <Lumi
                                arms="phone"
                                eyes="happy"
                                phone
                                px={7}
                            />
                        </div>
                        <div>
                            <p className={styles.lumiSay}>
                                {'"Arrow keys become a joystick. Other keys become buttons. You make the game, ' +
                                    'I sort out the controls."'}
                            </p>
                            <p className={styles.lumiWho}>{'Lumi, resident robot'}</p>
                        </div>
                    </div>
                </section>

                <section
                    className={classNames(styles.section, styles.makers)}
                    id="makers"
                    aria-labelledby="makers-title"
                >
                    <div>
                        <p className={styles.kicker}>{'FOR MAKERS'}</p>
                        <h2
                            className={styles.h2}
                            id="makers-title"
                        >
                            {'Simple on the surface. '}
                            <em>{'Deep underneath.'}</em>
                        </h2>
                        <p className={styles.secLede}>
                            {'Blocks get you started in minutes. When you want more, the power is all there.'}
                        </p>
                    </div>
                    <ul className={styles.feats}>
                        {[
                            ['01', 'Fast, compiled blocks', 'Built on TurboWarp, so games run smoothly at 60 frames a second.'],
                            ['02', 'Bigger, sharper stages', 'Custom stage sizes and high quality pen for crisp, ' +
                                'widescreen games.'],
                            ['03', 'Bring your Scratch projects', 'Open any .sb3 file or paste a Scratch link and play it ' +
                                'with touch controls.'],
                            ['04', 'Phone blocks', 'Joystick, swipe, tilt, vibration and save blocks for proper phone games.'],
                            ['05', 'Export, coming soon', 'Turn a game into a web page for itch.io, or an Android app.'],
                            ['06', 'Free and open source', 'Free software you can read and improve. No ads, ever.']
                        ].map(([n, title, text]) => (
                            <li
                                key={n}
                                className={styles.feat}
                            >
                                <span className={styles.featN}>{n}</span>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    className={classNames(styles.section, styles.parents)}
                    id="parents"
                    aria-labelledby="parents-title"
                >
                    <div>
                        <p className={styles.kicker}>{'FOR PARENTS & TEACHERS'}</p>
                        <h2
                            className={styles.h2}
                            id="parents-title"
                        >
                            {'Real coding skills. '}
                            <em>{'Zero setup.'}</em>
                        </h2>
                        <p className={styles.parentsText}>
                            {'Sparkjam runs in the browser on Chromebooks, tablets and laptops. Players learn loops, ' +
                                'events and logic by making games they actually want to play.'}
                        </p>
                    </div>
                    <ul className={styles.trust}>
                        {[
                            ['FREE, NO ADS', 'Every feature, no paywalls, nothing to click away to.'],
                            ['NOTHING TO INSTALL', 'Works in the browser on school laptops, tablets and phones.'],
                            ['INVITE-ONLY JAMS', 'When jams arrive: no public chat and no strangers. Players only ' +
                                'jam with people they invite.'],
                            ['PARENT CONSENT', 'When accounts arrive, under-13s will need a parent\'s OK before ' +
                                'they save or jam.']
                        ].map(([title, text]) => (
                            <li
                                key={title}
                                className={styles.trustCard}
                            >
                                <b>{title}</b>
                                <span>{text}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                <section
                    className={classNames(styles.section, styles.final)}
                    aria-labelledby="final-title"
                >
                    <p className={styles.finalKicker}>{'INSERT IDEA TO CONTINUE'}</p>
                    <h2
                        className={styles.finalTitle}
                        id="final-title"
                    >{'YOUR GAME STARTS HERE'}</h2>
                    <div className={classNames(styles.ctas, styles.finalCtas)}>
                        <a
                            className={sj.btn}
                            href={links.newGame}
                        >{'▶ START MAKING'}</a>
                        <JamCodeField
                            id="jam-code-final"
                            onSoon={soon}
                        />
                    </div>
                </section>
            </main>

            <SiteFooter onSoon={soon} />
            {soonDialog}
        </div>
    );
};

export default Landing;
