// Sparkjam: My games (/my-games, design A3). Games saved to the maker's account and in this browser,
// together: open, rename, download, delete, or save a this-device-only game to the account.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from '../sj/pixel-art.jsx';
import {SiteNav, SiteFooter, useSoon, JamCodeField, styles as sj} from '../sj/site.jsx';
import {listGames, getGame, renameGame, deleteGame, timeAgo} from '../../lib/sj-library';
import {listCloudGames, loadCloudGame, saveCloudGame, deleteCloudGame} from '../../lib/sj-cloud';
import {isAccountReady} from '../../lib/sj-auth';
import {useAccount, openAccountDialog} from '../sj/account.jsx';
import {links} from '../../lib/sj-links';
import styles from './my-games.css';

// The game's .sb3, from this browser if it's here, otherwise from the account.
const gameBlob = async game => {
    if (game.local) {
        const full = await getGame(game.id);
        if (full) return full.sb3;
    }
    return new Blob([await loadCloudGame(game.id)]);
};

const download = async game => {
    const url = URL.createObjectURL(await gameBlob(game));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title || 'game'}.sb3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const GameTile = ({game, canSaveOnline, onChanged}) => {
    const [working, setWorking] = useState('');
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
                                if (title && title !== game.title) {
                                    if (game.local) await renameGame(game.id, title);
                                    if (game.cloud) {
                                        await saveCloudGame({id: game.id,
                                            title,
                                            sb3: await gameBlob(game),
                                            thumbnail: game.thumbnail});
                                    }
                                }
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
                    <span className={classNames(styles.where, {[styles.whereCloud]: game.cloud})}>
                        {game.cloud ? 'ON YOUR ACCOUNT' : 'THIS DEVICE ONLY'}
                    </span>
                    {working ? <span className={styles.working}>{working}</span> : null}
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
                            className={styles.menuBackdrop}
                            onClick={close}
                            aria-hidden="true"
                        />
                    ) : null}
                    {menu ? (
                        <div
                            className={styles.menu}
                            role="menu"
                            onKeyDown={e => {
                                if (e.key === 'Escape') close();
                            }}
                        >
                            <p className={styles.menuTitle}>{game.title || 'Untitled game'}</p>
                            {confirmDelete ? (
                                <React.Fragment>
                                    <p className={styles.confirm}>
                                        {game.cloud ?
                                            'Delete this game from your account and this device? ' +
                                                'You can\'t undo this.' :
                                            'Delete this game from this device? You can\'t undo this.'}
                                    </p>
                                    <button
                                        role="menuitem"
                                        className={styles.danger}
                                        onClick={async () => {
                                            close();
                                            setWorking('Deleting…');
                                            try {
                                                if (game.cloud) await deleteCloudGame(game.id);
                                                if (game.local) await deleteGame(game.id);
                                            } catch (err) {
                                                setWorking(err.message);
                                                return;
                                            }
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
                                    {canSaveOnline && !game.cloud ? (
                                        <button
                                            role="menuitem"
                                            onClick={async () => {
                                                close();
                                                setWorking('Saving to your account…');
                                                try {
                                                    const full = await getGame(game.id);
                                                    await saveCloudGame({id: game.id,
                                                        title: game.title,
                                                        sb3: full.sb3,
                                                        thumbnail: game.thumbnail});
                                                    setWorking('');
                                                    onChanged();
                                                } catch (err) {
                                                    setWorking(err.message);
                                                }
                                            }}
                                        >{'Save to my account'}</button>
                                    ) : null}
                                    <button
                                        role="menuitem"
                                        onClick={() => {
                                            close();
                                            download(game).catch(err => setWorking(err.message));
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
        updatedAt: PropTypes.number,
        local: PropTypes.bool,
        cloud: PropTypes.bool
    }).isRequired,
    canSaveOnline: PropTypes.bool,
    onChanged: PropTypes.func.isRequired
};

const MyGames = () => {
    const [soonDialog, soon] = useSoon();
    const account = useAccount();
    const ready = isAccountReady(account);
    const [games, setGames] = useState(null);
    const [failed, setFailed] = useState(false);
    const [cloudError, setCloudError] = useState('');
    const [query, setQuery] = useState('');
    const refresh = async () => {
        const byId = new Map();
        try {
            (await listGames()).forEach(g => byId.set(g.id, {...g, local: true, cloud: false}));
            setFailed(false);
        } catch (e) {
            setFailed(true);
        }
        if (ready) {
            try {
                (await listCloudGames()).forEach(g => {
                    const mine = byId.get(g.id);
                    byId.set(g.id, mine && mine.updatedAt > g.updatedAt ?
                        {...mine, cloud: true} :
                        {...g, local: !!mine, cloud: true, thumbnail: g.thumbnail || (mine && mine.thumbnail)});
                });
                setCloudError('');
            } catch (e) {
                setCloudError(e.message);
            }
        }
        setGames([...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt));
    };
    useEffect(() => {
        refresh();
    }, [ready]);
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
                    {ready ? (
                        <p>
                            {`Signed in as ${account.makerName}. Games you make save to your account and in this ` +
                                'browser, so you can open them anywhere.'}
                        </p>
                    ) : (
                        <p>
                            {'These games are saved in this browser, as you make them. '}
                            <button onClick={() => openAccountDialog('save')}>{'Sign in'}</button>
                            {' to keep them online and on all your devices.'}
                        </p>
                    )}
                </div>
                {cloudError ? (
                    <p
                        className={styles.error}
                        role="alert"
                    >{`${cloudError} Games on this device are shown below.`}</p>
                ) : null}

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
                                canSaveOnline={ready}
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
