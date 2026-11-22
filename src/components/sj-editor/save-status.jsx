// Sparkjam: "Saved on this device" in the editor's menu bar.

import React, {useEffect, useState} from 'react';
import classNames from 'classnames';
import {getSaveStatus, onSaveStatus} from '../../lib/sj-save-status';
import {links} from '../../lib/sj-links';
import {openAccountDialog} from '../sj/account.jsx';
import styles from './save-status.css';

const LABELS = {
    idle: 'Not saved yet',
    unsaved: 'Saving soon…',
    saving: 'Saving…',
    saved: 'Saved on this device',
    savedAccount: 'Saved to your account',
    error: 'Couldn\'t save this game'
};

/* eslint-disable react/jsx-no-bind */
const SaveStatus = () => {
    const [status, setStatus] = useState(getSaveStatus());
    useEffect(() => onSaveStatus(setStatus), []);
    const label = status.state === 'saved' && status.where === 'account' ? LABELS.savedAccount :
        LABELS[status.state];
    return (
        <span className={styles.wrap}>
            <a
                className={classNames(styles.pill, styles[status.state])}
                href={links.myGames}
                title={status.cloudError || 'Open My games to see all your games.'}
                aria-live="polite"
            >
                <i aria-hidden="true" />
                {label}
            </a>
            {status.account ? null : (
                <button
                    className={styles.signIn}
                    onClick={() => openAccountDialog('save')}
                    type="button"
                >{'Sign in to save online'}</button>
            )}
        </span>
    );
};

export default SaveStatus;
