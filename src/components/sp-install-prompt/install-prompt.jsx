// ScratchPro: a small "Install game" button for the play page.
// - Android/Chrome/Edge: uses the browser's install prompt (beforeinstallprompt).
// - iPhone/iPad Safari: there is no prompt, so it explains Share > Add to Home Screen.
// Hidden when the game is already running as an installed app, or after the player closes it.

import React from 'react';
import styles from './install-prompt.css';

const DISMISS_KEY = 'sp:install-dismissed';

const isInstalled = () => (
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) ||
    navigator.standalone === true
);

const isIOS = () => (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

const wasDismissed = () => {
    try {
        return localStorage.getItem(DISMISS_KEY) === '1';
    } catch (e) {
        return false;
    }
};

const rememberDismissed = () => {
    try {
        localStorage.setItem(DISMISS_KEY, '1');
    } catch (e) {
        // ignore: private mode or storage blocked
    }
};

class InstallPrompt extends React.Component {
    constructor (props) {
        super(props);
        this.deferredPrompt = null;
        this.hidden = isInstalled() || wasDismissed();
        this.state = {
            // null (hidden), 'prompt' or 'ios'. iOS has no install prompt event, so show help there.
            mode: !this.hidden && isIOS() ? 'ios' : null,
            showIOSHelp: false
        };
        this.handleBeforeInstallPrompt = this.handleBeforeInstallPrompt.bind(this);
        this.handleInstalled = this.handleInstalled.bind(this);
        this.handleInstall = this.handleInstall.bind(this);
        this.handleClose = this.handleClose.bind(this);
    }
    componentDidMount () {
        if (this.hidden) return;
        window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', this.handleInstalled);
    }
    componentWillUnmount () {
        window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', this.handleInstalled);
    }
    handleBeforeInstallPrompt (e) {
        e.preventDefault();
        this.deferredPrompt = e;
        this.setState({mode: 'prompt'});
    }
    handleInstalled () {
        this.deferredPrompt = null;
        this.setState({mode: null});
    }
    handleInstall () {
        if (this.state.mode === 'ios') {
            this.setState(state => ({showIOSHelp: !state.showIOSHelp}));
            return;
        }
        if (!this.deferredPrompt) return;
        const prompt = this.deferredPrompt;
        this.deferredPrompt = null;
        prompt.prompt();
        prompt.userChoice
            .then(choice => {
                if (choice && choice.outcome === 'accepted') {
                    this.setState({mode: null});
                }
            })
            .catch(() => {});
    }
    handleClose () {
        rememberDismissed();
        this.setState({mode: null});
    }
    render () {
        if (!this.state.mode) return null;
        return (
            <div className={styles.wrapper}>
                {this.state.showIOSHelp ? (
                    <div className={styles.help}>
                        {'Tap the Share button '}
                        <span
                            className={styles.shareIcon}
                            aria-hidden="true"
                        >{'⬆︎'}</span>
                        {' then "Add to Home Screen".'}
                    </div>
                ) : null}
                <div className={styles.pill}>
                    <button
                        className={styles.install}
                        onClick={this.handleInstall}
                    >
                        {'📲 Install game'}
                    </button>
                    <button
                        className={styles.close}
                        onClick={this.handleClose}
                        aria-label="Close"
                        title="Close"
                    >
                        {'×'}
                    </button>
                </div>
            </div>
        );
    }
}

export default InstallPrompt;
