// ScratchPro: the play-only page (play.html). A game on its own, full screen, with touch controls,
// that can be installed to a phone's home screen and played offline.
//
//   play.html            Spark Hop (the sample game)
//   play.html#123456     a Scratch project by ID
//
// It reuses the embed player (edge-to-edge stage, floating flag/stop buttons, touch controls) but is
// a top-level page with its own app manifest (static/play.webmanifest) and service worker
// (static/play-sw.js) so it can be installed and works without a connection.

import './import-first';

import React from 'react';
import {compose} from 'redux';
import AppStateHOC from '../lib/app-state-hoc.jsx';
import TWEmbedFullScreenHOC from '../lib/tw-embed-fullscreen-hoc.jsx';
import TWStateManagerHOC from '../lib/tw-state-manager-hoc.jsx';
import {Theme} from '../lib/themes/index.js';

import GUI from './render-gui.jsx';
import SPTouchControls from '../containers/sp-touch-controls.jsx';
import SPInstallPrompt from '../components/sp-install-prompt/install-prompt.jsx';
import render from './app-target';

const getProjectId = () => {
    const hashMatch = location.hash.match(/#(\d+)/);
    return hashMatch === null ? '0' : hashMatch[1];
};

const urlParams = new URLSearchParams(location.search);

// Scope the service worker to the play page only, so the editor and home page are unaffected.
const registerServiceWorker = () => {
    if (!navigator.serviceWorker || typeof navigator.serviceWorker.register !== 'function') return;
    navigator.serviceWorker.register('play-sw.js', {scope: 'play'})
        .catch(err => {
            // eslint-disable-next-line no-console
            console.warn('ScratchPro: offline play is not available', err);
        });
};

// Once the game has loaded, hand the service worker the files this page used so the game also
// works offline the next time. (The first visit loads before the service worker is in control.)
const cacheLoadedFiles = () => {
    if (!navigator.serviceWorker || !window.performance || !performance.getEntriesByType) return;
    navigator.serviceWorker.ready.then(registration => {
        if (!registration.active) return;
        const page = location.href.split('#')[0];
        const urls = performance.getEntriesByType('resource')
            .map(entry => entry.name)
            .filter(url => url.startsWith(location.origin));
        registration.active.postMessage({type: 'cache-urls', urls: [page].concat(urls)});
    })
        .catch(() => {});
};

let vm;

const onVmInit = _vm => {
    vm = _vm;
};

const onProjectLoaded = () => {
    if (urlParams.has('autoplay')) {
        vm.start();
        vm.greenFlag();
    }
    cacheLoadedFiles();
};

const handleUpdateProjectTitle = (title, isDefault) => {
    if (!isDefault && title) {
        document.title = title;
    }
};

const Play = props => (
    <React.Fragment>
        <GUI {...props} />
        <SPTouchControls />
        <SPInstallPrompt />
    </React.Fragment>
);

const WrappedGUI = compose(
    AppStateHOC,
    TWStateManagerHOC,
    TWEmbedFullScreenHOC
)(Play);

render(<WrappedGUI
    isEmbedded
    projectId={getProjectId()}
    onVmInit={onVmInit}
    onProjectLoaded={onProjectLoaded}
    onUpdateProjectTitle={handleUpdateProjectTitle}
    routingStyle="none"
    theme={Theme.light}
/>);

window.addEventListener('hashchange', () => location.reload());

if (document.readyState === 'complete') {
    registerServiceWorker();
} else {
    window.addEventListener('load', registerServiceWorker);
}
