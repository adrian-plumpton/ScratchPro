// Sparkjam: the game page around the player (/game, design P3). The stage sits on the left; the side
// panel says what the game is, how to play it, and offers full screen, remix and jam. Below are
// more games and a box for playing a Scratch project.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {connect} from 'react-redux';
import {setFullScreen} from '../../reducers/mode';
import {getIsError} from '../../reducers/project-state';
import {Lumi} from '../sj/pixel-art.jsx';
import {GameCard, ScratchLinkField, styles as sj} from '../sj/site.jsx';
import Description from '../tw-description/description.jsx';
import {SAMPLE_GAMES, getSampleGame} from '../../lib/sample-games';
import {requestedSample} from '../../lib/sample-project';
import {links} from '../../lib/sj-links';
import styles from './game-page.css';

const CHIP_COLORS = {
    lav: 'var(--lav)',
    yellow: 'var(--yellow)',
    cyan: 'var(--cyan)',
    pink: 'var(--pink)'
};

/**
 * The sample being played, if the player is showing one of ours rather than a Scratch project.
 * @param {string} projectId The loaded project's id ('0' for the default project, which is a sample).
 * @returns {?object} The sample game.
 */
const currentSample = projectId => {
    if (projectId && projectId !== '0') return null;
    return requestedSample() || getSampleGame('spark-hop');
};

const GameSide = ({isError, projectId, projectTitle, author, description, onFullScreen}) => {
    // The error screen in the stage column says what went wrong and what to do instead.
    if (isError) return null;
    const sample = currentSample(projectId);
    const title = sample ? sample.title : (projectTitle || 'Scratch project');
    return (
        <aside className={styles.side}>
            <h1 className={styles.title}>{title.toUpperCase()}</h1>
            <div className={styles.by}>
                {sample ? (
                    <React.Fragment>
                        <Lumi px={1.6} />
                        {`A sample by Sparkjam · ${sample.kind}`}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        {author.username ? `By ${author.username} on Scratch` : 'From Scratch'}
                        {' · '}
                        <a href={`https://scratch.mit.edu/projects/${projectId}/`}>{'View on Scratch'}</a>
                    </React.Fragment>
                )}
            </div>
            {sample ? <p className={styles.desc}>{sample.long}</p> : null}
            {sample ? (
                <div className={styles.how}>
                    <h2 className={styles.howTitle}>{'HOW TO PLAY'}</h2>
                    {sample.controls.map(([chip, color, what, keys]) => (
                        <div
                            key={chip}
                            className={styles.howRow}
                        >
                            <span
                                className={styles.howChip}
                                style={{background: CHIP_COLORS[color]}}
                            >{chip}</span>
                            <span>
                                {what}
                                <span className={styles.keys}>{` · ${keys}`}</span>
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}
            {!sample && (description.instructions || description.credits) ? (
                <div className={styles.scratchDesc}>
                    <Description
                        instructions={description.instructions}
                        credits={description.credits}
                        projectId={projectId}
                    />
                </div>
            ) : null}
            {sample ? null : (
                <p className={styles.desc}>
                    {'On phones, arrow keys become a joystick and other keys become buttons.'}
                </p>
            )}
            <div className={styles.acts}>
                <button
                    className={classNames(sj.btn, sj.btnWide)}
                    onClick={onFullScreen}
                >{'▶ PLAY FULL SCREEN'}</button>
                <a
                    className={classNames(sj.btn, sj.btnGhost, sj.btnWide)}
                    href={sample ? links.remixSample(sample.id) : links.remixScratch(projectId)}
                >{'REMIX'}</a>
                <a
                    className={classNames(sj.btn, sj.btnCyan, sj.btnWide)}
                    href={sample ? links.jamOnSample(sample.id) : links.jamOnScratch(projectId)}
                >{'JAM ON THIS GAME'}</a>
            </div>
            <p className={styles.note}>{'Remix without an account. Saving online and jamming need one.'}</p>
        </aside>
    );
};
GameSide.propTypes = {
    isError: PropTypes.bool,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string,
    author: PropTypes.shape({username: PropTypes.string}),
    description: PropTypes.shape({
        instructions: PropTypes.string,
        credits: PropTypes.string
    }),
    onFullScreen: PropTypes.func
};

const ConnectedGameSide = connect(
    state => ({
        isError: getIsError(state.scratchGui.projectState.loadingState),
        projectId: state.scratchGui.projectState.projectId,
        projectTitle: state.scratchGui.projectTitle,
        author: state.scratchGui.tw.author,
        description: state.scratchGui.tw.description
    }),
    dispatch => ({
        onFullScreen: () => dispatch(setFullScreen(true))
    })
)(GameSide);

const Crumb = ({isError, projectId, projectTitle}) => {
    const sample = currentSample(projectId);
    if (isError) return <nav className={styles.crumb}><a href={links.games}>{'← Games'}</a></nav>;
    return (
        <nav
            className={styles.crumb}
            aria-label="Breadcrumb"
        >
            <a href={links.games}>{'Games'}</a>
            {' / '}
            <b>{sample ? sample.title : (projectTitle || 'Scratch project')}</b>
        </nav>
    );
};
Crumb.propTypes = {
    isError: PropTypes.bool,
    projectId: PropTypes.string,
    projectTitle: PropTypes.string
};
const ConnectedCrumb = connect(state => ({
    isError: getIsError(state.scratchGui.projectState.loadingState),
    projectId: state.scratchGui.projectState.projectId,
    projectTitle: state.scratchGui.projectTitle
}))(Crumb);

const MoreGames = ({projectId}) => {
    const sample = currentSample(projectId);
    const others = SAMPLE_GAMES.filter(game => !sample || game.id !== sample.id).slice(0, 3);
    return (
        <div className={styles.below}>
            <section aria-labelledby="more-games">
                <h2
                    className={styles.moreTitle}
                    id="more-games"
                >{'MORE GAMES'}</h2>
                <div className={styles.moreCards}>
                    {others.map(game => (
                        <GameCard
                            key={game.id}
                            game={game}
                            showText={false}
                        />
                    ))}
                </div>
            </section>
            <section
                className={styles.scratch}
                aria-labelledby="scratch-title"
            >
                <h2 id="scratch-title">{'Got a Scratch project?'}</h2>
                <p>{'Paste a link or project number from scratch.mit.edu to play it here, with touch ' +
                    'controls on phones.'}</p>
                <ScratchLinkField id="game-scratch-link" />
            </section>
        </div>
    );
};
MoreGames.propTypes = {
    projectId: PropTypes.string
};
const ConnectedMoreGames = connect(state => ({
    projectId: state.scratchGui.projectState.projectId
}))(MoreGames);

export {
    ConnectedGameSide as GameSide,
    ConnectedCrumb as Crumb,
    ConnectedMoreGames as MoreGames
};
