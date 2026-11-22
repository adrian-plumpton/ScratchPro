// Sparkjam: the games gallery (/games, design P2). Play or remix the samples, filter them, or paste
// a Scratch link to play it here.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useState} from 'react';
import classNames from 'classnames';
import {Lumi} from '../sj/pixel-art.jsx';
import {SiteNav, SiteFooter, GameCard, useSoon, ScratchLinkField, styles as sj} from '../sj/site.jsx';
import {SAMPLE_GAMES, getSampleGame} from '../../lib/sample-games';
import {links} from '../../lib/sj-links';
import styles from './games.css';

const FILTERS = [
    ['all', 'ALL', () => true],
    ['platformers', 'PLATFORMERS', g => g.filter === 'platformers'],
    ['racers', 'RACERS', g => g.filter === 'racers'],
    ['tap', 'TAP GAMES', g => g.filter === 'tap'],
    ['mazes', 'MAZES', g => g.filter === 'mazes'],
    null,
    ['joystick', 'JOYSTICK', g => g.chips.includes('JOYSTICK')],
    ['taponly', 'TAP ONLY', g => g.chips.includes('TAP ONLY')]
];

const matches = (game, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [game.title, game.kind, game.description, ...game.chips].join(' ').toLowerCase()
        .includes(q);
};

const Games = () => {
    const [soonDialog, soon] = useSoon();
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const test = FILTERS.find(f => f && f[0] === filter)[2];
    const shown = SAMPLE_GAMES.filter(game => test(game) && matches(game, query));
    const featured = getSampleGame('spark-hop');
    return (
        <div className={sj.page}>
            <SiteNav
                active="games"
                onSoon={soon}
            />
            <main className={styles.main}>
                <div className={styles.head}>
                    <div>
                        <h1 className={styles.h1}>{'GAMES'}</h1>
                        <p className={styles.sub}>{'Play in your browser, then remix any game to see how it works.'}</p>
                    </div>
                    <label className={styles.search}>
                        <span className={sj.visuallyHidden}>{'Search games'}</span>
                        <input
                            type="search"
                            placeholder="Search games"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </label>
                </div>

                <section
                    className={styles.feat}
                    aria-labelledby="featured-title"
                >
                    <a
                        href={links.sample(featured.id)}
                        tabIndex={-1}
                        aria-hidden="true"
                    >
                        <img
                            src={links.thumbnail(featured.id)}
                            alt=""
                        />
                    </a>
                    <div className={styles.featBody}>
                        <span className={styles.k}>{'FEATURED SAMPLE'}</span>
                        <h2
                            className={styles.featTitle}
                            id="featured-title"
                        >{featured.title.toUpperCase()}</h2>
                        <p className={styles.featText}>{featured.long}</p>
                        <div className={sj.chips}>
                            {featured.chips.map(chip => (
                                <span
                                    key={chip}
                                    className={sj.chip}
                                >{chip}</span>
                            ))}
                        </div>
                        <div className={styles.acts}>
                            <a
                                className={sj.btn}
                                href={links.sample(featured.id)}
                            >{'▶ PLAY'}</a>
                            <a
                                className={classNames(sj.btn, sj.btnGhost)}
                                href={links.remixSample(featured.id)}
                            >{'REMIX'}</a>
                        </div>
                        <div className={styles.lumi}>
                            <Lumi
                                arms="wave"
                                eyes="happy"
                                px={2}
                            />
                            {`"${featured.tip}"`}
                        </div>
                    </div>
                </section>

                <div
                    className={styles.filters}
                    role="group"
                    aria-label="Filter games"
                >
                    {FILTERS.map((f, i) => (f ? (
                        <button
                            key={f[0]}
                            className={classNames(styles.f, {[styles.on]: filter === f[0]})}
                            aria-pressed={filter === f[0]}
                            onClick={() => setFilter(f[0])}
                        >{f[1]}</button>
                    ) : (
                        <span
                            key={`sep${i}`}
                            className={styles.sep}
                        />
                    )))}
                </div>

                {shown.length ? (
                    <div className={sj.cards}>
                        {shown.map(game => (
                            <GameCard
                                key={game.id}
                                game={game}
                                headingLevel={2}
                            />
                        ))}
                    </div>
                ) : (
                    <div className={styles.empty}>
                        <Lumi
                            eyes="sad"
                            px={4}
                        />
                        <p>{'No games match that yet. Try another search, or make one yourself!'}</p>
                        <a
                            className={classNames(sj.btn, sj.btnSm)}
                            href={links.newGame}
                        >{'START MAKING'}</a>
                    </div>
                )}

                <div className={styles.more}>
                    <div className={styles.box}>
                        <h2>{'Got a Scratch project?'}</h2>
                        <p>{'Paste a link or project number from scratch.mit.edu to play it here, with touch ' +
                            'controls on phones.'}</p>
                        <ScratchLinkField id="scratch-link" />
                    </div>
                    <div className={styles.box}>
                        <span className={sj.soon}>{'COMING SOON'}</span>
                        <h2>{'Games made with Sparkjam'}</h2>
                        <p>{'Soon you\'ll be able to share your games here for others to play and remix.'}</p>
                    </div>
                </div>
            </main>
            <SiteFooter onSoon={soon} />
            {soonDialog}
        </div>
    );
};

export default Games;
