// Sparkjam: the "something broke" screen (design S7). Light in tone, clear about what to do.

import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import LumiNotice from '../sj/lumi-notice.jsx';
import sj from '../sj/sj.css';

const REPORT_URL = 'https://github.com/adrian-plumpton/scratchpro/issues';

const CrashMessage = props => (
    <LumiNotice
        pose={{eyes: 'wink', arms: 'wave'}}
        say="Well, that wasn't meant to happen. Sparkjam hit a glitch."
        actions={
            <React.Fragment>
                <button
                    className={sj.btn}
                    onClick={props.onReload}
                >{'RELOAD'}</button>
                <a
                    className={classNames(sj.btn, sj.btnGhost)}
                    href={REPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                >{'REPORT THE GLITCH'}</a>
            </React.Fragment>
        }
    >
        <p>{'Reload to carry on. If it keeps happening, tell us and we\'ll fix it.'}</p>
        {props.eventId ? <p>{`Glitch code: ${props.eventId}`}</p> : null}
        {props.errorMessage ? <pre>{props.errorMessage}</pre> : null}
    </LumiNotice>
);

CrashMessage.propTypes = {
    eventId: PropTypes.string,
    errorMessage: PropTypes.string,
    onReload: PropTypes.func.isRequired
};

export default CrashMessage;
