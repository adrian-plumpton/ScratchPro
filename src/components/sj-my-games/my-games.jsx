// Sparkjam: My games (/my-games, design A3). The games saved in this browser: open, rename,
// download or delete them, or start a new one. Online saving comes with accounts.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from '../sj/pixel-art.jsx';
import {SiteNav, SiteFooter, useSoon, JamCodeField, styles as sj} from '../sj/site.jsx';
import {listGames, getGame, renameGame, deleteGame, timeAgo} from '../../lib/sj-library';
import {links} from '../../lib/sj-links';
import styles from './my-games.css';

const download = async game => {
    const full = await getGame(game.id);
    if (!full) return;
    const url = URL.createObjectURL(full.sb3);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title || 'game'}.sb3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const GameTile = ({game, onChanged}) => {
    const [menu, setMenu] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const close = () => {
        setMenu(false);
        setConfirmDelete(false);
    };
    return (
        <article className={styles.tile}>
            <a
                href={links.savedGame(game.id)}
                tabIndex={-1}
                aria-hidden="true"
            >
                {game.thumbnail ? (
                    <img
                        className={styles.art}
                        src={game.thumbnail}
                        alt=""
                    />
                ) : (
                    <span className={classNames(styles.art, styles.noArt)}>
                        <Lumi px={4} />
                    </span>
                )}
            </a>
            <div className={styles.body}>
                <div className={styles.info}>
                    {renaming ? (
                        <form
                            onSubmit={async e => {
                                e.preventDefault();
                                const title = e.target.elements.title.value.trim();
                                if (title) await renameGame(game.id, title);
                                setRenaming(false);
                                onChanged();
                            }}
                        >
                            <label
                                className={sj.visuallyHidden}
                                htmlFor={`rename-${game.id}`}
                            >{'New name'}</label>
                            <input
                                id={`rename-${game.id}`}
                                name="title"
                                className={styles.rename}
                                defaultValue={game.title}
                                maxLength={100}
                                autoFocus
                                onBlur={e => e.target.form && e.target.form.requestSubmit()}
                                onKeyDown={e => {
                                    if (e.key === 'Escape') setRenaming(false);
                                }}
                            />
                        </form>
                    ) : (
                        <h2 className={styles.name}>
                            <a href={links.savedGame(game.id)}>{game.title || 'Untitled game'}</a>
                        </h2>
                    )}
                    <span className={styles.when}>{`Edited ${timeAgo(game.updatedAt)}`}</span>
                </div>
                <div className={styles.more}>
                    <button
                        className={styles.moreButton}
                        aria-label={`More for ${game.title}`}
                        aria-expanded={menu}
                        onClick={() => setMenu(!menu)}
                    >{'···'}</button>
                    {menu ? (
                        <div
                            className={styles.menu}
                            role="menu"
                        >
                            {confirmDelete ? (
                                <React.Fragment>
                                    <p className={styles.confirm}>
                                        {'Delete this game from this device? You can\'t undo this.'}
                                    </p>
                                    <button
                                        role="menuitem"
                                        className={styles.danger}
                                        onClick={async () => {
                                            await deleteGame(game.id);
                                            close();
                                            onChanged();
                                        }}
                                    >{'Yes, delete it'}</button>
                                    <button
                                        role="menuitem"
                                        onClick={close}
                                    >{'Keep it'}</button>
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    <a
                                        role="menuitem"
                                        href={links.savedGame(game.id)}
                                    >{'Open in the editor'}</a>
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            close();
                                            setRenaming(true);
                                        }}
                                    >{'Rename'}</button>
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            close();
                                            download(game);
                                        }}
                                    >{'Download .sb3'}</button>
                                    <button
                                        role="menuitem"
                                        className={styles.danger}
                                        onClick={() => setConfirmDelete(true)}
                                    >{'Delete'}</button>
                                </React.Fragment>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </article>
    );
};
GameTile.propTypes = {
    game: PropTypes.shape({
        id: PropTypes.string,
        title: PropTypes.string,
        thumbnail: PropTypes.string,
        updatedAt: PropTypes.number
    }).isRequired,
    onChanged: PropTypes.func.isRequired
};

const MyGames = () => {
    const [soonDialog, soon] = useSoon();
    const [games, setGames] = useState(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState('');
    const refresh = () => listGames()
        .then(setGames)
        .catch(() => {
            setFailed(true);
            setGames([]);
        });
    useEffect(() => {
        refresh();
    }, []);
    const q = query.trim().toLowerCase();
    const shown = (games || []).filter(g => !q || (g.title || '').toLowerCase()
        .includes(q));
    return (
        <div className={sj.page}>
            <SiteNav
                active="mine"
                onSoon={soon}
            />
            <main className={styles.main}>
                <div className={styles.head}>
                    <h1 className={styles.h1}>{'MY GAMES'}</h1>
                    <label className={styles.search}>
                        <span className={sj.visuallyHidden}>{'Search my games'}</span>
                        <input
                            type="search"
                            placeholder="Search my games"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                    </label>
                    <JamCodeField
                        id="my-games-jam-code"
                        onSoon={soon}
                    />
                    <a
                        className={sj.btn}
                        href={links.newGame}
                    >{'+ NEW GAME'}</a>
                </div>

                <div className={styles.note}>
                    <Lumi
                        arms="phone"
                        phone
                        px={2}
                    />
                    <p>
                        {'These games are saved in this browser, as you make them. '}
                        <button onClick={() => soon('signin')}>{'Accounts'}</button>
                        {' will keep them online and on all your devices.'}
                    </p>
                </div>

                {failed ? (
                    <p
                        className={styles.error}
                        role="alert"
                    >{'This browser won\'t let Sparkjam save games (private browsing can do this). ' +
                        'You can still download games from the editor\'s File menu.'}</p>
                ) : null}

                {games === null ? null : (
                    <div className={styles.grid}>
                        {shown.map(game => (
                            <GameTile
                                key={game.id}
                                game={game}
                                onChanged={refresh}
                            />
                        ))}
                        {q && !shown.length ? (
                            <p className={styles.none}>{'No games match that search.'}</p>
                        ) : null}
                        <a
                            className={styles.newTile}
                            href={links.newGame}
                        >
                            <span className={styles.plus}>{'+'}</span>
                            <span className={styles.newName}>{'NEW GAME'}</span>
                            <span>{games.length ? 'Start from a template' : 'Make your first game'}</span>
                        </a>
                    </div>
                )}
            </main>
            <SiteFooter onSoon={soon} />
            {soonDialog}
        </div>
    );
};

export default MyGames;
