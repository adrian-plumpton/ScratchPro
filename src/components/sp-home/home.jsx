// ScratchPro: the home page, made for young game makers. Bright, simple and focused on two things:
// playing a game made with blocks, and making your own.

import React from 'react';
import PropTypes from 'prop-types';
import {APP_NAME} from '../../lib/brand.js';
import styles from './home.css';

const root = process.env.ROOT || '';
const EDITOR_URL = `${root}editor.html`;
const BLANK_EDITOR_URL = `${root}editor.html?blank`;
const PLAY_URL = `${root}play.html`;

const HomeHeader = () => (
    <header className={styles.header}>
        <a
            className={styles.logo}
            href={`${root}index.html`}
        >
            <span
                className={styles.logoMark}
                aria-hidden="true"
            >{'✦'}</span>
            {APP_NAME}
        </a>
        <a
            className={styles.headerButton}
            href={BLANK_EDITOR_URL}
        >
            {'Make a game'}
        </a>
    </header>
);

const HomeHero = () => (
    <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
            {'Make your own '}
            <span className={styles.highlight}>{'phone games'}</span>
        </h1>
        <p className={styles.heroText}>
            {'Snap code blocks together, then play your game on any phone or tablet.'}
        </p>
        <p className={styles.tryLabel}>
            {'👇 Try Spark Hop! Press the green flag to start.'}
        </p>
    </section>
);

const ActionCard = ({href, emoji, title, text, colour}) => (
    <a
        className={`${styles.actionCard} ${styles[colour]}`}
        href={href}
    >
        <span
            className={styles.actionEmoji}
            aria-hidden="true"
        >{emoji}</span>
        <span className={styles.actionTitle}>{title}</span>
        <span className={styles.actionText}>{text}</span>
    </a>
);

ActionCard.propTypes = {
    colour: PropTypes.oneOf(['purple', 'yellow', 'pink']).isRequired,
    emoji: PropTypes.string.isRequired,
    href: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

const Step = ({number, title, text}) => (
    <li className={styles.step}>
        <span className={styles.stepNumber}>{number}</span>
        <span className={styles.stepTitle}>{title}</span>
        <span className={styles.stepText}>{text}</span>
    </li>
);

Step.propTypes = {
    number: PropTypes.string.isRequired,
    text: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired
};

const HomeSections = () => (
    <React.Fragment>
        <section className={styles.actions}>
            <ActionCard
                href={EDITOR_URL}
                emoji={'🔧'}
                title="See how it works"
                text="Open Spark Hop and change anything you like."
                colour="purple"
            />
            <ActionCard
                href={BLANK_EDITOR_URL}
                emoji={'✨'}
                title="Start a new game"
                text="Begin with an empty stage and your own idea."
                colour="yellow"
            />
            <ActionCard
                href={PLAY_URL}
                emoji={'📲'}
                title="Put it on your phone"
                text="Install Spark Hop like an app. Works offline too."
                colour="pink"
            />
        </section>

        <section className={styles.steps}>
            <h2 className={styles.sectionTitle}>{'How it works'}</h2>
            <ol className={styles.stepList}>
                <Step
                    number="1"
                    title="Snap blocks"
                    text="Drag colourful blocks to make things move, jump and score."
                />
                <Step
                    number="2"
                    title="Get touch controls"
                    text="Use the arrow keys in your code and a joystick appears by itself."
                />
                <Step
                    number="3"
                    title="Play anywhere"
                    text="Play on a phone or tablet, or install your game like an app."
                />
            </ol>
        </section>
    </React.Fragment>
);

const HomeFooter = () => (
    <footer className={styles.footer}>
        <nav className={styles.footerLinks}>
            <a href={`${root}credits.html`}>{'Credits'}</a>
            <a href={`${root}privacy.html`}>{'Privacy'}</a>
            <a href="https://github.com/adrian-plumpton/ScratchPro/issues">{'Feedback'}</a>
            <a href="https://github.com/adrian-plumpton/ScratchPro">{'Source code'}</a>
        </nav>
        <p className={styles.footerText}>
            {`${APP_NAME} is based on `}
            <a href="https://turbowarp.org/">{'TurboWarp'}</a>
            {`. ${APP_NAME} is not affiliated with Scratch, the Scratch Team, or the Scratch Foundation. ` +
                'Scratch is a project of the Scratch Foundation. It is available for free at '}
            <a href="https://scratch.org/">{'https://scratch.org/'}</a>
            {'.'}
        </p>
    </footer>
);

export {
    HomeHeader,
    HomeHero,
    HomeSections,
    HomeFooter
};
