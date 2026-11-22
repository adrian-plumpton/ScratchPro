/**
 * Copyright (C) 2021 Thomas Weber
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import {compose} from 'redux';
import {defineMessages, injectIntl, intlShape} from 'react-intl';
import {getIsLoading} from '../reducers/project-state.js';
import AppStateHOC from '../lib/app-state-hoc.jsx';
import ErrorBoundaryHOC from '../lib/error-boundary-hoc.jsx';
import TWProjectMetaFetcherHOC from '../lib/tw-project-meta-fetcher-hoc.jsx';
import TWStateManagerHOC from '../lib/tw-state-manager-hoc.jsx';
import TWPackagerIntegrationHOC from '../lib/tw-packager-integration-hoc.jsx';
import SettingsStore from '../addons/settings-store-singleton';
import '../lib/tw-fix-history-api';
import GUI from './render-gui.jsx';
import BrowserModal from '../components/browser-modal/browser-modal.jsx';
import CloudVariableBadge from '../containers/tw-cloud-variable-badge.jsx';
import TWWindchimeSubmitter from '../containers/tw-windchime-submitter.jsx';
import {isBrowserSupported} from '../lib/tw-environment-support-prober';
import AddonChannels from '../addons/channels';
import {loadServiceWorker} from './load-service-worker';
import runAddons from '../addons/entry';
import InvalidEmbed from '../components/tw-invalid-embed/invalid-embed.jsx';
import {APP_NAME} from '../lib/brand.js';
import SPTouchControls from '../containers/sp-touch-controls.jsx';
import SPMobileEditor from '../containers/sp-mobile-editor.jsx';
import {SiteNav, SiteFooter, SoonDialog, styles as sj} from '../components/sj/site.jsx';
import {GameSide, Crumb, MoreGames} from '../components/sj-game/game-page.jsx';
import gameStyles from '../components/sj-game/game-page.css';
import {requestedSample} from '../lib/sample-project';
import NewGamePicker from '../components/sj-editor/new-game-picker.jsx';
import DeviceSaver from '../components/sj-editor/device-saver.jsx';
import {JamOverlay, JamSpriteFaces} from '../components/sj-jam/jam-ui.jsx';

import styles from './interface.css';

const isInvalidEmbed = window.parent !== window;
// Sparkjam: games are saved to My games from the editor page only.
const isEditorPage = /\/editor(\.html)?$/.test(location.pathname);

const handleClickAddonSettings = addonId => {
    // addonId might be a string of the addon to focus on, undefined, or an event (treat like undefined)
    const path = process.env.ROUTING_STYLE === 'wildcard' ? 'addons' : 'addons.html';
    const url = `${process.env.ROOT}${path}${typeof addonId === 'string' ? `#${addonId}` : ''}`;
    window.open(url);
};

const messages = defineMessages({
    defaultTitle: {
        defaultMessage: 'Make and play games on any device',
        description: 'Title of homepage',
        id: 'sp.guiDefaultTitle'
    }
});

if (AddonChannels.reloadChannel) {
    AddonChannels.reloadChannel.addEventListener('message', () => {
        location.reload();
    });
}

if (AddonChannels.changeChannel) {
    AddonChannels.changeChannel.addEventListener('message', e => {
        SettingsStore.setStoreWithVersionCheck(e.data);
    });
}

runAddons();

class Interface extends React.Component {
    constructor (props) {
        super(props);
        this.handleUpdateProjectTitle = this.handleUpdateProjectTitle.bind(this);
        this.handleSoon = this.handleSoon.bind(this);
        this.handleProjectLoaded = this.handleProjectLoaded.bind(this);
        this.autoStarted = false;
        this.handleCloseSoon = this.handleCloseSoon.bind(this);
        this.state = {soon: null};
    }
    componentDidUpdate (prevProps) {
        if (prevProps.isLoading && !this.props.isLoading) {
            loadServiceWorker();
        }
    }
    handleProjectLoaded () {
        // Sparkjam: pressing Play on a sample (/game?sample=id) starts it straight away, once.
        if (this.autoStarted || !this.props.isPlayerOnly || !requestedSample() || this.props.projectId !== '0') return;
        this.autoStarted = true;
        this.props.vm.start();
        this.props.vm.greenFlag();
    }
    handleSoon (soon) {
        this.setState({soon});
    }
    handleCloseSoon () {
        this.setState({soon: null});
    }
    handleUpdateProjectTitle (title, isDefault) {
        if (isDefault || !title) {
            document.title = `${APP_NAME} - ${this.props.intl.formatMessage(messages.defaultTitle)}`;
        } else {
            document.title = `${title} - ${APP_NAME}`;
        }
    }
    render () {
        if (isInvalidEmbed) {
            return <InvalidEmbed />;
        }

        const {
            /* eslint-disable no-unused-vars */
            intl,
            hasCloudVariables,
            description,
            isFullScreen,
            isLoading,
            isPlayerOnly,
            isRtl,
            projectId,
            vm,
            /* eslint-enable no-unused-vars */
            ...props
        } = this.props;
        const isHomepage = isPlayerOnly && !isFullScreen;
        const isEditor = !isPlayerOnly;
        // Sparkjam: on the game page (/game) the player sits inside the site's nav and side panel, and
        // the stage sizes itself to its column (see screen-utils). The element tree is the same in
        // every mode so the GUI is never remounted when switching to full screen or the editor.
        return (
            <div
                className={classNames(styles.container, {
                    [styles.playerOnly]: isHomepage,
                    [sj.page]: isHomepage,
                    [styles.sjFullscreen]: isPlayerOnly && isFullScreen,
                    [styles.editor]: isEditor
                })}
                dir={isRtl ? 'rtl' : 'ltr'}
            >
                <TWWindchimeSubmitter />
                {isHomepage ? <SiteNav onSoon={this.handleSoon} /> : null}
                <div className={isHomepage ? gameStyles.main : styles.center}>
                    {isHomepage ? <Crumb /> : null}
                    <div className={isHomepage ? gameStyles.stageCol : styles.center}>
                        <GUI
                            onClickAddonSettings={handleClickAddonSettings}
                            onUpdateProjectTitle={this.handleUpdateProjectTitle}
                            onProjectLoaded={this.handleProjectLoaded}
                            backpackVisible
                            backpackHost="_local_"
                            {...props}
                        />
                        <SPTouchControls />
                        <SPMobileEditor />
                        {isEditor ? <NewGamePicker /> : null}
                        {isEditorPage ? <DeviceSaver /> : null}
                        {isEditor ? <JamOverlay /> : null}
                        {isEditor ? <JamSpriteFaces /> : null}
                        {isHomepage && !isBrowserSupported() ? (
                            <BrowserModal isRtl={isRtl} />
                        ) : null}
                        {isHomepage && hasCloudVariables && projectId !== '0' ? (
                            <div className={styles.section}>
                                <CloudVariableBadge />
                            </div>
                        ) : null}
                    </div>
                    {isHomepage ? <GameSide onSoon={this.handleSoon} /> : null}
                </div>
                {isHomepage ? <MoreGames /> : null}
                {isHomepage ? <SiteFooter onSoon={this.handleSoon} /> : null}
                {this.state.soon ? (
                    <SoonDialog
                        what={this.state.soon}
                        onClose={this.handleCloseSoon}
                    />
                ) : null}
            </div>
        );
    }
}

Interface.propTypes = {
    intl: intlShape,
    hasCloudVariables: PropTypes.bool,
    customStageSize: PropTypes.shape({
        width: PropTypes.number,
        height: PropTypes.number
    }),
    description: PropTypes.shape({
        credits: PropTypes.string,
        instructions: PropTypes.string
    }),
    isFullScreen: PropTypes.bool,
    isLoading: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    projectId: PropTypes.string,
    vm: PropTypes.shape({
        start: PropTypes.func,
        greenFlag: PropTypes.func
    })
};

const mapStateToProps = state => ({
    hasCloudVariables: state.scratchGui.tw.hasCloudVariables,
    customStageSize: state.scratchGui.customStageSize,
    description: state.scratchGui.tw.description,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    isLoading: getIsLoading(state.scratchGui.projectState.loadingState),
    isPlayerOnly: state.scratchGui.mode.isPlayerOnly,
    isRtl: state.locales.isRtl,
    projectId: state.scratchGui.projectState.projectId,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = () => ({});

const ConnectedInterface = injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(Interface));

const WrappedInterface = compose(
    AppStateHOC,
    ErrorBoundaryHOC('TW Interface'),
    TWProjectMetaFetcherHOC,
    TWStateManagerHOC,
    TWPackagerIntegrationHOC
)(ConnectedInterface);

export default WrappedInterface;
