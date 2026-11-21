// ScratchPro: a gallery of sample games on the home page. Play loads a game onto the stage and starts it;
// Remix loads it and opens the editor.

import bindAll from 'lodash.bindall';
import PropTypes from 'prop-types';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {connect} from 'react-redux';

import {SAMPLE_GAMES, sampleFileUrl} from '../../lib/sample-games';
import {
    LoadingState,
    LoadingStates,
    getIsShowingProject,
    onLoadedProject,
    requestProjectUpload
} from '../../reducers/project-state';
import {openLoadingProject, closeLoadingProject} from '../../reducers/modals';
import {setPlayer} from '../../reducers/mode';
import {setProjectTitle} from '../../reducers/project-title';
import {setFileHandle} from '../../reducers/tw';
import log from '../../lib/log';
import styles from './sample-games.css';

class SampleGames extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handlePlay',
            'handleRemix'
        ]);
        this.state = {
            loadingId: null,
            failedId: null
        };
    }
    handlePlay (e) {
        this.loadGame(e.currentTarget.dataset.id, false);
    }
    handleRemix (e) {
        this.loadGame(e.currentTarget.dataset.id, true);
    }
    async loadGame (id, remix) {
        const game = SAMPLE_GAMES.find(g => g.id === id);
        if (!game || this.state.loadingId || !this.props.isShowingProject) return;
        this.setState({loadingId: id, failedId: null});
        let started = false;
        try {
            const response = await fetch(sampleFileUrl(id, 'sb3'));
            if (!response.ok) throw new Error(`Request returned status ${response.status}`);
            const buffer = await response.arrayBuffer();
            this.props.onStartLoading(this.props.loadingState);
            started = true;
            await this.props.vm.loadProject(buffer);
            this.props.onFinishLoading(true, game.title);
            if (remix) {
                this.props.onSeeInside();
            } else {
                window.scrollTo({top: 0, behavior: 'smooth'});
                this.props.vm.start();
                this.props.vm.greenFlag();
            }
            this.setState({loadingId: null});
        } catch (err) {
            log.error('Could not load sample game', err);
            if (started) this.props.onFinishLoading(false);
            this.setState({loadingId: null, failedId: id});
        }
    }
    render () {
        const busy = this.state.loadingId !== null;
        return (
            <div className={styles.container}>
                <h2 className={styles.heading}>
                    <FormattedMessage
                        defaultMessage="Sample games"
                        description="Heading for the sample games on the home page"
                        id="sp.samples.heading"
                    />
                </h2>
                <p className={styles.intro}>
                    <FormattedMessage
                        // eslint-disable-next-line max-len
                        defaultMessage="Play one, then press Remix to see the blocks and make it your own. Games that use keys get on-screen controls on phones and tablets."
                        description="Introduction to the sample games on the home page"
                        id="sp.samples.intro"
                    />
                </p>
                <div className={styles.grid}>
                    {SAMPLE_GAMES.map(game => (
                        <div
                            className={styles.card}
                            key={game.id}
                        >
                            <button
                                className={styles.picture}
                                data-id={game.id}
                                disabled={busy}
                                onClick={this.handlePlay}
                                title={`Play ${game.title}`}
                            >
                                <img
                                    alt=""
                                    draggable={false}
                                    loading="lazy"
                                    src={sampleFileUrl(game.id, 'svg')}
                                />
                            </button>
                            <div className={styles.body}>
                                <h3 className={styles.title}>{game.title}</h3>
                                <p className={styles.description}>{game.description}</p>
                                <p className={styles.controls}>{game.controls}</p>
                                <div className={styles.buttons}>
                                    <button
                                        className={`${styles.button} ${styles.play}`}
                                        data-id={game.id}
                                        disabled={busy}
                                        onClick={this.handlePlay}
                                    >
                                        {this.state.loadingId === game.id ? (
                                            <FormattedMessage
                                                defaultMessage="Loading…"
                                                description="Shown on a sample game's button while it loads"
                                                id="sp.samples.loading"
                                            />
                                        ) : (
                                            <FormattedMessage
                                                defaultMessage="Play"
                                                description="Button to play a sample game"
                                                id="sp.samples.play"
                                            />
                                        )}
                                    </button>
                                    <button
                                        className={`${styles.button} ${styles.remix}`}
                                        data-id={game.id}
                                        disabled={busy}
                                        onClick={this.handleRemix}
                                    >
                                        <FormattedMessage
                                            defaultMessage="Remix"
                                            description="Button to open a sample game in the editor"
                                            id="sp.samples.remix"
                                        />
                                    </button>
                                </div>
                                {this.state.failedId === game.id && (
                                    <p className={styles.error}>
                                        <FormattedMessage
                                            defaultMessage="This game didn't load. Check your connection and try again."
                                            description="Error when a sample game fails to load"
                                            id="sp.samples.error"
                                        />
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
}

SampleGames.propTypes = {
    isShowingProject: PropTypes.bool,
    loadingState: PropTypes.oneOf(LoadingStates),
    onFinishLoading: PropTypes.func,
    onSeeInside: PropTypes.func,
    onStartLoading: PropTypes.func,
    vm: PropTypes.shape({
        greenFlag: PropTypes.func,
        loadProject: PropTypes.func,
        start: PropTypes.func
    })
};

const mapStateToProps = state => ({
    isShowingProject: getIsShowingProject(state.scratchGui.projectState.loadingState),
    loadingState: state.scratchGui.projectState.loadingState,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onStartLoading: loadingState => {
        dispatch(openLoadingProject());
        dispatch(requestProjectUpload(loadingState));
    },
    onFinishLoading: (success, title) => {
        dispatch(onLoadedProject(LoadingState.LOADING_VM_FILE_UPLOAD, false, success));
        dispatch(closeLoadingProject());
        if (success) {
            dispatch(setFileHandle(null));
            dispatch(setProjectTitle(title));
        }
    },
    onSeeInside: () => dispatch(setPlayer(false))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(SampleGames);
