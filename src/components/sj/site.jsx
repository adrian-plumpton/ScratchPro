// Sparkjam: the pieces every page shares. The nav, footer, game cards, Lumi's dialog, and the
// jam code and Scratch link fields.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from './pixel-art.jsx';
import {AccountDialog, AccountButton, openAccountDialog} from './account.jsx';
import {links, parseScratchProject} from '../../lib/sj-links';
import styles from './sj.css';

const Wordmark = () => (
    <a
        className={styles.wordmark}
        href={links.home}
        aria-label="Sparkjam home"
    >
        <span className={styles.wordmarkA}>{'SPARK'}</span>
        <span className={styles.wordmarkB}>{'JAM'}</span>
    </a>
);

// What Lumi says about the things that are not built yet.
const SOON = {
    signin: {
        say: 'Accounts are coming soon!',
        small: 'You will need one to save games online, jam with friends and share what you make. ' +
            'Until then you can make and play without one, and save games to your device from ' +
            'the editor\'s File menu.'
    },
    jam: {
        say: 'Jams are coming soon!',
        small: 'Soon you will be able to open a jam from any game and build it live with friends you ' +
            'invite. Jams will need an account.'
    }
};

/**
 * Lumi's dialog, used for "coming soon" messages.
 * @param {object} props Props.
 * @param {string} props.what Which message: signin or jam.
 * @param {Function} props.onClose Called when the dialog is closed.
 * @returns {React.ReactElement} The dialog.
 */
const SoonDialog = ({what, onClose}) => {
    const okRef = useRef(null);
    useEffect(() => {
        if (okRef.current) okRef.current.focus();
        const onKey = e => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const message = SOON[what];
    return (
        <div
            className={styles.dialogBackdrop}
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <Lumi
                arms="wave"
                eyes="happy"
                px={5}
            />
            <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="sj-soon-title"
            >
                <span className={styles.dialogWho}>{'LUMI'}</span>
                <p
                    className={styles.dialogSay}
                    id="sj-soon-title"
                >{message.say}</p>
                <p className={styles.dialogSmall}>{message.small}</p>
                <div className={styles.dialogActions}>
                    <button
                        ref={okRef}
                        className={styles.btn}
                        onClick={onClose}
                    >{'OK'}</button>
                </div>
            </div>
        </div>
    );
};
SoonDialog.propTypes = {
    what: PropTypes.oneOf(Object.keys(SOON)).isRequired,
    onClose: PropTypes.func.isRequired
};

/**
 * State for a page's "coming soon" dialog.
 * @returns {Array} [the dialog element or null, a function that opens it with a message name].
 */
const useSoon = () => {
    const [what, setWhat] = useState(null);
    const close = React.useCallback(() => setWhat(null), []);
    const dialog = what ? (
        <SoonDialog
            what={what}
            onClose={close}
        />
    ) : null;
    return [dialog, setWhat];
};

// onSoon is kept for pages that pass it; sign-in is real now.
// eslint-disable-next-line no-unused-vars
const SiteNav = ({active, clear, onSoon}) => (
    <React.Fragment>
        <AccountDialog />
        <SiteNavBar
            active={active}
            clear={clear}
        />
    </React.Fragment>
);
SiteNav.propTypes = {
    active: PropTypes.string,
    clear: PropTypes.bool,
    onSoon: PropTypes.func.isRequired
};

const SiteNavBar = ({active, clear}) => (
    <nav
        className={classNames(styles.nav, {[styles.navClear]: clear})}
        aria-label="Main"
    >
        <Wordmark />
        <div className={styles.navLinks}>
            <a
                className={classNames(styles.navHide, {[styles.navOn]: active === 'mine'})}
                href={links.myGames}
                aria-current={active === 'mine' ? 'page' : null}
            >{'My games'}</a>
            <a
                className={classNames(styles.navHide, {[styles.navOn]: active === 'games'})}
                href={links.games}
                aria-current={active === 'games' ? 'page' : null}
            >{'Games'}</a>
            <a
                className={styles.navHide}
                href={`${links.home}#jam`}
            >{'Jam'}</a>
            <a
                className={styles.navHide}
                href={`${links.home}#makers`}
            >{'For makers'}</a>
            <AccountButton className={classNames(styles.navSignin, styles.navHide)} />
            <a
                className={classNames(styles.btn, styles.btnSm)}
                href={links.newGame}
            >{'START MAKING'}</a>
        </div>
    </nav>
);
SiteNavBar.propTypes = {
    active: PropTypes.string,
    clear: PropTypes.bool
};

const SiteFooter = ({onSoon}) => (
    <footer className={styles.footer}>
        <div className={styles.footerRow}>
            <div>
                <Wordmark />
                <p style={{marginTop: '12px'}}>{'A tiny game studio in your browser.'}</p>
            </div>
            <div className={styles.footerCols}>
                <div className={styles.footerCol}>
                    <span className={styles.footerHead}>{'PLAY'}</span>
                    <a href={links.games}>{'Games'}</a>
                    <button onClick={() => onSoon('jam')}>{'Join a jam'}</button>
                    <button onClick={() => openAccountDialog('save')}>{'Sign in'}</button>
                </div>
                <div className={styles.footerCol}>
                    <span className={styles.footerHead}>{'MAKE'}</span>
                    <a href={links.newGame}>{'Start making'}</a>
                    <a href={links.myGames}>{'My games'}</a>
                    <a href={`${links.home}#makers`}>{'For makers'}</a>
                    <a href={`${links.home}#parents`}>{'Parents & teachers'}</a>
                </div>
                <div className={styles.footerCol}>
                    <span className={styles.footerHead}>{'ABOUT'}</span>
                    <a href={links.source}>{'Source code'}</a>
                    <a href={links.credits}>{'Credits'}</a>
                    <a href={links.turbowarp}>{'Built on TurboWarp'}</a>
                </div>
            </div>
        </div>
        <p className={styles.legal}>
            {'Sparkjam is not affiliated with Scratch, the Scratch Team, or the Scratch Foundation. ' +
                'Scratch is a project of the Scratch Foundation, available for free at https://scratch.org/.'}
        </p>
    </footer>
);
SiteFooter.propTypes = {
    onSoon: PropTypes.func.isRequired
};

const GameCard = ({game, showText, headingLevel}) => {
    const Heading = `h${headingLevel}`;
    return (
        <article className={styles.card}>
            <a
                href={links.sample(game.id)}
                tabIndex={-1}
                aria-hidden="true"
            >
                <img
                    className={styles.cardArt}
                    src={links.thumbnail(game.id)}
                    alt=""
                    loading="lazy"
                />
            </a>
            <div className={styles.cardBody}>
                <div>
                    <Heading className={styles.cardTitle}>{game.title.toUpperCase()}</Heading>
                    <span className={styles.cardKind}>{game.kind}</span>
                </div>
                <div className={styles.chips}>
                    {game.chips.map(chip => (
                        <span
                            key={chip}
                            className={styles.chip}
                        >{chip}</span>
                    ))}
                </div>
                {showText ? <p className={styles.cardText}>{game.description}</p> : null}
                <div className={styles.cardActions}>
                    <a
                        className={classNames(styles.btn, styles.btnSm)}
                        href={links.sample(game.id)}
                        aria-label={`Play ${game.title}`}
                    >{'PLAY'}</a>
                    <a
                        className={classNames(styles.btn, styles.btnSm, styles.btnGhost)}
                        href={links.remixSample(game.id)}
                        aria-label={`Remix ${game.title}`}
                    >{'REMIX'}</a>
                </div>
            </div>
        </article>
    );
};
GameCard.propTypes = {
    game: PropTypes.shape({
        id: PropTypes.string,
        title: PropTypes.string,
        kind: PropTypes.string,
        chips: PropTypes.arrayOf(PropTypes.string),
        description: PropTypes.string
    }).isRequired,
    showText: PropTypes.bool,
    headingLevel: PropTypes.number
};
GameCard.defaultProps = {
    showText: true,
    headingLevel: 3
};

// Jam codes look like JAM-4827. Jams are not built yet, so joining explains that.
const JamCodeField = ({onSoon, id}) => (
    <form
        className={styles.code}
        onSubmit={e => {
            e.preventDefault();
            onSoon('jam');
        }}
    >
        <label
            className={styles.codePrefix}
            htmlFor={id}
        >
            <span className={styles.visuallyHidden}>{'Jam code'}</span>
            {'JAM-'}
        </label>
        <input
            id={id}
            className={styles.codeInput}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="____"
        />
        <button
            className={styles.codeGo}
            type="submit"
        >{'JOIN'}</button>
    </form>
);
JamCodeField.propTypes = {
    onSoon: PropTypes.func.isRequired,
    id: PropTypes.string.isRequired
};

// Paste a Scratch link or project number to play it on the game page.
const ScratchLinkField = ({id}) => {
    const [error, setError] = useState(false);
    return (
        <form
            onSubmit={e => {
                e.preventDefault();
                const project = parseScratchProject(e.target.elements[id].value);
                if (project) {
                    location.href = links.scratchGame(project);
                } else {
                    setError(true);
                }
            }}
        >
            <div className={styles.field}>
                <label
                    className={styles.visuallyHidden}
                    htmlFor={id}
                >{'Scratch project link or number'}</label>
                <input
                    id={id}
                    className={styles.fieldInput}
                    placeholder="scratch.mit.edu/projects/..."
                    autoComplete="off"
                    onChange={() => setError(false)}
                    aria-invalid={error}
                    aria-describedby={error ? `${id}-error` : null}
                />
                <button
                    className={styles.codeGo}
                    type="submit"
                >{'PLAY'}</button>
            </div>
            {error ? (
                <p
                    id={`${id}-error`}
                    className={styles.fieldError}
                    role="alert"
                >{'That doesn\'t look like a Scratch project. Paste a link like scratch.mit.edu/projects/123456.'}</p>
            ) : null}
        </form>
    );
};
ScratchLinkField.propTypes = {
    id: PropTypes.string.isRequired
};

export {
    Wordmark,
    SiteNav,
    SiteFooter,
    GameCard,
    SoonDialog,
    useSoon,
    JamCodeField,
    ScratchLinkField
};
export {styles};
