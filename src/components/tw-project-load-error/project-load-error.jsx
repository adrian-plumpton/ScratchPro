// Sparkjam: friendly screens for projects that can't be opened (design S7), in Lumi's voice.

import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import LumiNotice from '../sj/lumi-notice.jsx';
import sj from '../sj/sj.css';
import {links} from '../../lib/sj-links';
import {ProjectUnavailableLegalReasons, ProjectUnsharedError, ProjectFetchError} from '../../lib/tw-load-project-error';
import {SavedGameMissingError} from '../../lib/sj-library';

const UNSHARED_DOCS = 'https://docs.turbowarp.org/unshared-projects';

const isSafeURL = url => {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (e) {
        return false;
    }
};

const ExternalLink = ({href, children}) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
    >{children}</a>
);
ExternalLink.propTypes = {
    children: PropTypes.node,
    href: PropTypes.string.isRequired
};

const actions = (
    <React.Fragment>
        <a
            className={sj.btn}
            href={`${links.games}#scratch-link`}
        >{'TRY ANOTHER LINK'}</a>
        <a
            className={classNames(sj.btn, sj.btnGhost)}
            href={links.sample('spark-hop')}
        >{'PLAY A SAMPLE'}</a>
    </React.Fragment>
);

/**
 * @param {unknown} error The error that stopped the project from loading.
 * @returns {boolean} true if ProjectLoadError has a friendly message for this error.
 */
const isKnownProjectLoadError = error => (
    error instanceof ProjectUnsharedError ||
    error instanceof ProjectUnavailableLegalReasons ||
    error instanceof ProjectFetchError ||
    error instanceof SavedGameMissingError
);

const ProjectLoadError = ({error, isFullScreen}) => {
    if (error instanceof SavedGameMissingError) {
        return (
            <LumiNotice
                fullScreen={isFullScreen}
                say="I can't find that game on this device."
                actions={
                    <React.Fragment>
                        <a
                            className={sj.btn}
                            href={links.myGames}
                        >{'MY GAMES'}</a>
                        <a
                            className={classNames(sj.btn, sj.btnGhost)}
                            href={links.newGame}
                        >{'START A NEW GAME'}</a>
                    </React.Fragment>
                }
            >
                <p>{'Games are saved in the browser they were made in. It might be on another device, ' +
                    'or this browser\'s data was cleared.'}</p>
            </LumiNotice>
        );
    }
    if (error instanceof ProjectUnavailableLegalReasons) {
        return (
            <LumiNotice
                fullScreen={isFullScreen}
                say="I can't open this one. It was taken down after a copyright claim."
                actions={actions}
            >
                {error.moreUrl && isSafeURL(error.moreUrl) ? (
                    <p><ExternalLink href={error.moreUrl}>{'Read the notice'}</ExternalLink></p>
                ) : null}
            </LumiNotice>
        );
    }
    return (
        <LumiNotice
            fullScreen={isFullScreen}
            say="I can't open this one. It might be private or deleted on Scratch."
            actions={actions}
        >
            <p>{'Only shared Scratch projects can be played here. Check the link, or ask the maker to share it.'}</p>
            <p>
                {'Shared it in the last half hour? Give it a little longer. '}
                <ExternalLink href={UNSHARED_DOCS}>{'Learn more'}</ExternalLink>
            </p>
        </LumiNotice>
    );
};

ProjectLoadError.propTypes = {
    error: PropTypes.instanceOf(Error).isRequired,
    isFullScreen: PropTypes.bool
};

export {
    ProjectLoadError as default,
    isKnownProjectLoadError
};
