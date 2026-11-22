// Sparkjam: a full-area message from Lumi, used for project errors and crashes (design S7).
// Every notice says what happened and what to do next, with a way forward.

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from './pixel-art.jsx';
import sj from './sj.css';
import styles from './lumi-notice.css';

const LumiNotice = ({pose, say, children, actions, fullScreen}) => (
    <div className={classNames(sj.page, styles.wrapper, {[styles.fullScreen]: fullScreen})}>
        <div className={styles.inner}>
            <Lumi
                px={7}
                {...pose}
            />
            <div
                className={classNames(sj.dialog, styles.box)}
                role="alert"
            >
                <span className={sj.dialogWho}>{'LUMI'}</span>
                <p className={sj.dialogSay}>{say}</p>
                <div className={styles.small}>{children}</div>
            </div>
            <div className={styles.actions}>{actions}</div>
        </div>
    </div>
);
LumiNotice.propTypes = {
    pose: PropTypes.shape({
        arms: PropTypes.string,
        eyes: PropTypes.string
    }),
    say: PropTypes.node.isRequired,
    children: PropTypes.node,
    actions: PropTypes.node,
    fullScreen: PropTypes.bool
};
LumiNotice.defaultProps = {
    pose: {eyes: 'sad'}
};

export default LumiNotice;
