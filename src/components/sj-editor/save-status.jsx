// Sparkjam: "Saved on this device" in the editor's menu bar.

import React, {useEffect, useState} from 'react';
import classNames from 'classnames';
import {getSaveStatus, onSaveStatus} from '../../lib/sj-save-status';
import {links} from '../../lib/sj-links';
import styles from './save-status.css';

const LABELS = {
    idle: 'Not saved yet',
    unsaved: 'Saving soon…',
    saving: 'Saving…',
    saved: 'Saved on this device',
    error: 'Couldn\'t save on this device'
};

const SaveStatus = () => {
    const [status, setStatus] = useState(getSaveStatus());
    useEffect(() => onSaveStatus(setStatus), []);
    return (
        <a
            className={classNames(styles.pill, styles[status.state])}
            href={links.myGames}
            title="Games are saved in this browser. Open My games to see them all."
            aria-live="polite"
        >
            <i aria-hidden="true" />
            {LABELS[status.state]}
        </a>
    );
};

export default SaveStatus;
