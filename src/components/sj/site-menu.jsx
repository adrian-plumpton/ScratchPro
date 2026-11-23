// Sparkjam: the site menu for small screens. A button that opens a sheet with every main page,
// so makers on phones can always get home, to the games and to My games, even from the editor.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useRef, useState} from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {openAccountDialog, useAccount} from './account.jsx';
import {isAccountReady, signOut} from '../../lib/sj-auth';
import {links} from '../../lib/sj-links';
import sj from './sj.css';
import styles from './site-menu.css';

const ITEMS = [
    {id: 'home', label: 'Home', icon: '⌂', href: () => links.home},
    {id: 'games', label: 'Games', icon: '▶', href: () => links.games},
    {id: 'mine', label: 'My games', icon: '★', href: () => links.myGames},
    {id: 'new', label: 'Start a new game', icon: '+', href: () => links.newGame},
    {id: 'jam', label: 'Jam with friends', icon: '♪', href: () => `${links.home}#jam`}
];

const MenuSheet = ({active, onClose}) => {
    const account = useAccount();
    const closeRef = useRef(null);
    useEffect(() => {
        if (closeRef.current) closeRef.current.focus();
        const onKey = e => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);
    const ready = account && isAccountReady(account);
    return ReactDOM.createPortal(
        <div
            className={classNames(sj.tokens, styles.backdrop)}
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <nav
                className={styles.sheet}
                aria-label="Main"
                role="dialog"
                aria-modal="true"
            >
                <div className={styles.top}>
                    <a
                        className={styles.wordmark}
                        href={links.home}
                        aria-label="Sparkjam home"
                    >
                        <span className={styles.wordmarkA}>{'SPARK'}</span>
                        <span>{'JAM'}</span>
                    </a>
                    <button
                        ref={closeRef}
                        className={styles.close}
                        onClick={onClose}
                        aria-label="Close menu"
                        type="button"
                    >{'✕'}</button>
                </div>
                <ul className={styles.list}>
                    {ITEMS.map(item => (
                        <li key={item.id}>
                            <a
                                className={classNames(styles.item, {[styles.itemOn]: active === item.id})}
                                href={item.href()}
                                aria-current={active === item.id ? 'page' : null}
                                data-sj-menu={item.id}
                            >
                                <span
                                    className={styles.icon}
                                    aria-hidden="true"
                                >{item.icon}</span>
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
                <div className={styles.account}>
                    {ready ? (
                        <React.Fragment>
                            <div className={styles.me}>
                                <span className={styles.avatar}>{account.makerName[0]}</span>
                                {account.makerName}
                            </div>
                            <button
                                className={styles.ghost}
                                type="button"
                                onClick={async () => {
                                    onClose();
                                    await signOut();
                                }}
                            >{'Sign out'}</button>
                        </React.Fragment>
                    ) : (
                        <button
                            className={styles.ghost}
                            type="button"
                            onClick={() => {
                                onClose();
                                openAccountDialog('save');
                            }}
                        >{account ? 'Finish your account' : 'Sign in'}</button>
                    )}
                </div>
            </nav>
        </div>,
        document.body
    );
};
MenuSheet.propTypes = {
    active: PropTypes.string,
    onClose: PropTypes.func.isRequired
};

/**
 * The menu button and its sheet. Hide the button with CSS on screens wide enough for the full nav.
 * @param {object} props Props.
 * @param {string} [props.active] Which page this is: home, games, mine or editor.
 * @param {string} [props.className] Extra class for the button.
 * @returns {React.ReactElement} The button, and the sheet while it is open.
 */
const SiteMenuButton = ({active, className}) => {
    const [open, setOpen] = useState(false);
    return (
        <React.Fragment>
            <button
                className={classNames(styles.button, className)}
                onClick={() => setOpen(true)}
                aria-label="Menu"
                aria-expanded={open}
                aria-haspopup="dialog"
                data-sj-menu-button=""
                type="button"
            >
                <span className={styles.bars} />
            </button>
            {open ? (
                <MenuSheet
                    active={active}
                    onClose={() => setOpen(false)}
                />
            ) : null}
        </React.Fragment>
    );
};
SiteMenuButton.propTypes = {
    active: PropTypes.string,
    className: PropTypes.string
};

export {SiteMenuButton};
