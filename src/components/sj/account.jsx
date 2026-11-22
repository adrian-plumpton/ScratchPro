// Sparkjam: signing in (design A1/A2). One dialog for every page, opened with openAccountDialog().
// Steps: choose how to sign in, then (once, for new accounts) month and year of birth, a parent's OK for
// under-13s, and a maker name. Invite and password-reset links land on a "choose a password" step.
/* eslint-disable react/jsx-no-bind */ // Function components with hooks; handlers are cheap here.

import React, {useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Lumi} from './pixel-art.jsx';
import sj from './sj.css';
import styles from './account.css';
import {
    startAuth, getAccount, onAccount, takePendingCallback, authOptions, signInWithEmail, signUpWithEmail,
    signInWithGoogle, finishInvite, setNewPassword, sendPasswordReset, signOut, updateProfile,
    isAccountReady, ageFrom
} from '../../lib/sj-auth';
import {makerNames} from '../../lib/sj-maker-names';
import {links} from '../../lib/sj-links';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

// Opening the dialog from anywhere on the page.
const openers = new Set();
/**
 * @param {string} [reason] Why: 'save', 'jam' or 'share', for Lumi's message.
 * @returns {void}
 */
const openAccountDialog = reason => openers.forEach(open => open(reason || 'save'));

const REASONS = {
    save: 'Make a free account to save your games online and jam with friends.',
    jam: 'Jams need a free account, so friends know it\'s you.',
    share: 'Make a free account to share your games.'
};

/** @returns {?object} The signed-in account, kept up to date. */
const useAccount = () => {
    const [account, setAccount] = useState(getAccount());
    useEffect(() => {
        startAuth();
        return onAccount(setAccount);
    }, []);
    return account;
};

const errorText = e => {
    const message = (e && (e.message || e.error_description || e.msg)) || '';
    if (/invalid.*(grant|credentials|password)|no user found/i.test(message)) {
        return 'That email and password don\'t match an account.';
    }
    if (/already.*registered|already exists/i.test(message)) {
        return 'There\'s already an account with that email. Sign in instead.';
    }
    if (/signups? not allowed|disabled/i.test(message)) {
        return 'New accounts are invite-only while we test Sparkjam.';
    }
    if (/password/i.test(message)) return 'Passwords need at least 8 characters.';
    if (/not confirmed/i.test(message)) return 'Check your email and use the link to confirm your account first.';
    return 'That didn\'t work. Check your connection and try again.';
};

const Field = ({label, ...props}) => (
    <label className={styles.field}>
        <span>{label}</span>
        <input {...props} />
    </label>
);
Field.propTypes = {label: PropTypes.string};

// 1. Choose how to sign in.
const ChooseStep = ({reason, options, initialError, onDone}) => {
    const [mode, setMode] = useState('signin');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(initialError || '');
    const [notice, setNotice] = useState('');
    const submit = async e => {
        e.preventDefault();
        const form = e.target.elements;
        setBusy(true);
        setError('');
        try {
            if (mode === 'reset') {
                await sendPasswordReset(form.email.value);
                setNotice('If there\'s an account for that email, we\'ve sent a link to choose a new password.');
            } else if (mode === 'signup') {
                const account = await signUpWithEmail(form.email.value, form.password.value);
                if (account) onDone();
                else setNotice('Check your email: we\'ve sent a link to confirm your account.');
            } else {
                await signInWithEmail(form.email.value, form.password.value);
                onDone();
            }
        } catch (err) {
            setError(errorText(err));
        }
        setBusy(false);
    };
    return (
        <React.Fragment>
            <div className={styles.lumiBox}>
                <Lumi
                    arms="wave"
                    eyes="happy"
                    px={3}
                />
                <p>{REASONS[reason] || REASONS.save}</p>
            </div>
            {options.unavailable ? (
                <p className={styles.notice}>
                    {'Accounts aren\'t available on this copy of Sparkjam. Your games still save in this browser.'}
                </p>
            ) : null}
            {options.google ? (
                <button
                    className={styles.google}
                    onClick={signInWithGoogle}
                    type="button"
                >
                    <span
                        className={styles.g}
                        aria-hidden="true"
                    >{'G'}</span>
                    {'Continue with Google'}
                </button>
            ) : null}
            {options.google ? <div className={styles.or}><span>{'or use your email'}</span></div> : null}
            {notice ? <p className={styles.notice}>{notice}</p> : (
                <form
                    className={styles.form}
                    onSubmit={submit}
                >
                    <Field
                        label="Email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                    />
                    {mode === 'reset' ? null : (
                        <Field
                            label="Password"
                            name="password"
                            type="password"
                            minLength={8}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            required
                        />
                    )}
                    {error ? <p
                        className={styles.error}
                        role="alert"
                    >{error}</p> : null}
                    <button
                        className={classNames(sj.btn, sj.btnWide)}
                        disabled={busy}
                        type="submit"
                    >
                        {busy ? 'ONE MOMENT...' :
                            {signin: 'SIGN IN', signup: 'CREATE ACCOUNT', reset: 'SEND LINK'}[mode]}
                    </button>
                </form>
            )}
            <div className={styles.links}>
                {mode === 'signin' ? (
                    <React.Fragment>
                        {options.signupOpen ? (
                            <button
                                type="button"
                                onClick={() => setMode('signup')}
                            >{'New here? Create an account'}</button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setMode('reset')}
                        >{'Forgot your password?'}</button>
                    </React.Fragment>
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            setMode('signin');
                            setNotice('');
                            setError('');
                        }}
                    >{'Back to sign in'}</button>
                )}
            </div>
            {options.signupOpen ? null : (
                <p className={styles.small}>
                    {'New accounts are invite-only while we test Sparkjam. Got an invite? Use the link in the email.'}
                </p>
            )}
            <p className={styles.small}>
                {'Already have an account? The same buttons sign you in. You can always keep making without one: ' +
                    'games save in this browser.'}
            </p>
        </React.Fragment>
    );
};
ChooseStep.propTypes = {
    initialError: PropTypes.string,
    reason: PropTypes.string,
    options: PropTypes.shape({google: PropTypes.bool, signupOpen: PropTypes.bool, unavailable: PropTypes.bool}),
    onDone: PropTypes.func
};

// From an invite or a "reset password" link: choose a password.
const PasswordStep = ({callback, onDone}) => {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const submit = async e => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
            const password = e.target.elements.password.value;
            if (callback.type === 'invite') await finishInvite(callback.token, password);
            else await setNewPassword(password);
            onDone();
        } catch (err) {
            setError(errorText(err));
        }
        setBusy(false);
    };
    return (
        <form
            className={styles.form}
            onSubmit={submit}
        >
            <p className={styles.lede}>
                {callback.type === 'invite' ?
                    'You\'re invited! Choose a password for your Sparkjam account.' :
                    'Choose a new password for your account.'}
            </p>
            <Field
                label="Password (8 or more characters)"
                name="password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                required
            />
            {error ? <p
                className={styles.error}
                role="alert"
            >{error}</p> : null}
            <button
                className={classNames(sj.btn, sj.btnWide)}
                disabled={busy}
                type="submit"
            >{busy ? 'ONE MOMENT...' : 'NEXT'}</button>
        </form>
    );
};
PasswordStep.propTypes = {
    callback: PropTypes.shape({type: PropTypes.string, token: PropTypes.string}),
    onDone: PropTypes.func
};

// 2. When were you born? Month and year only, never shown to anyone.
const AgeStep = ({onDone}) => {
    const thisYear = new Date().getFullYear();
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const years = [];
    for (let y = thisYear - 5; y >= thisYear - 100; y--) years.push(y);
    const submit = async e => {
        e.preventDefault();
        setBusy(true);
        try {
            await updateProfile({birth_month: Number(month), birth_year: Number(year)});
            onDone();
        } catch (err) {
            setError(errorText(err));
            setBusy(false);
        }
    };
    return (
        <form
            className={styles.form}
            onSubmit={submit}
        >
            <h2 className={styles.title}>{'WHEN WERE YOU BORN?'}</h2>
            <p className={styles.lede}>
                {'We ask everyone. It helps us keep younger makers safe, and it\'s never shown to anyone.'}
            </p>
            <div className={styles.row}>
                <label className={styles.field}>
                    <span>{'Month'}</span>
                    <select
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        required
                    >
                        <option
                            value=""
                            disabled
                        >{'Month'}</option>
                        {MONTHS.map((name, i) => (
                            <option
                                key={name}
                                value={i + 1}
                            >{name}</option>
                        ))}
                    </select>
                </label>
                <label className={styles.field}>
                    <span>{'Year'}</span>
                    <select
                        value={year}
                        onChange={e => setYear(e.target.value)}
                        required
                    >
                        <option
                            value=""
                            disabled
                        >{'Year'}</option>
                        {years.map(y => (
                            <option
                                key={y}
                                value={y}
                            >{y}</option>
                        ))}
                    </select>
                </label>
            </div>
            {error ? <p
                className={styles.error}
                role="alert"
            >{error}</p> : null}
            <button
                className={classNames(sj.btn, sj.btnWide)}
                disabled={busy}
                type="submit"
            >{'NEXT'}</button>
            <p className={styles.small}>
                {'If you\'re under 13, we\'ll ask a parent or carer to say OK first. ' +
                    'You can keep making while you wait.'}
            </p>
        </form>
    );
};
AgeStep.propTypes = {onDone: PropTypes.func};

// Under 13: a parent or carer says OK. During testing the adult helping says OK here; the emailed
// approval in design A2 replaces this before launch.
const ConsentStep = ({onDone}) => {
    const [ok, setOk] = useState(false);
    const [busy, setBusy] = useState(false);
    return (
        <form
            className={styles.form}
            onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                await updateProfile({consent: 'test-phase-adult', consent_at: new Date().toISOString()});
                onDone();
            }}
        >
            <h2 className={styles.title}>{'ASK A GROWN-UP'}</h2>
            <p className={styles.lede}>
                {'Because you\'re under 13, a parent, carer or teacher needs to say OK before your account can ' +
                    'save games online. Show them this screen.'}
            </p>
            <div className={styles.adultBox}>
                <p>
                    {'For the grown-up: Sparkjam is free and has no ads. Accounts keep a maker name, month and ' +
                        'year of birth, and an email. Jams will be invite-only, with no public chat.'}
                </p>
                <label className={styles.check}>
                    <input
                        type="checkbox"
                        checked={ok}
                        onChange={e => setOk(e.target.checked)}
                    />
                    <span>{'I\'m their parent, carer or teacher, and I say OK.'}</span>
                </label>
            </div>
            <button
                className={classNames(sj.btn, sj.btnWide)}
                disabled={!ok || busy}
                type="submit"
            >{'NEXT'}</button>
            <p className={styles.small}>
                {'No grown-up around? That\'s fine: close this and keep making. Your games save in this browser.'}
            </p>
        </form>
    );
};
ConsentStep.propTypes = {onDone: PropTypes.func};

// 3. Pick a maker name from suggestions.
const NameStep = ({onDone}) => {
    const [names, setNames] = useState(() => makerNames(3));
    const [chosen, setChosen] = useState(names[0]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return (
        <form
            className={styles.form}
            onSubmit={async e => {
                e.preventDefault();
                setBusy(true);
                try {
                    await updateProfile({maker_name: chosen});
                    onDone();
                } catch (err) {
                    setError(errorText(err));
                    setBusy(false);
                }
            }}
        >
            <h2 className={styles.title}>{'PICK YOUR MAKER NAME'}</h2>
            <p className={styles.lede}>{'This is the name friends see in jams. Don\'t use your real name.'}</p>
            <div
                className={styles.names}
                role="radiogroup"
                aria-label="Maker names"
            >
                {names.map(name => (
                    <button
                        key={name}
                        type="button"
                        role="radio"
                        aria-checked={name === chosen}
                        className={classNames(styles.name, {[styles.nameOn]: name === chosen})}
                        onClick={() => setChosen(name)}
                    >
                        <span className={styles.avatar}>{name[0]}</span>
                        {name}
                    </button>
                ))}
            </div>
            {error ? <p
                className={styles.error}
                role="alert"
            >{error}</p> : null}
            <div className={styles.row}>
                <button
                    type="button"
                    className={classNames(sj.btn, sj.btnGhost)}
                    onClick={() => {
                        const next = makerNames(3);
                        setNames(next);
                        setChosen(next[0]);
                    }}
                >{'↻ MORE IDEAS'}</button>
                <button
                    className={sj.btn}
                    disabled={busy}
                    type="submit"
                >{'DONE'}</button>
            </div>
            <p className={styles.small}>
                {'Names are made from friendly word lists, so nobody can put rude words or real names in front of ' +
                    'other people.'}
            </p>
        </form>
    );
};
NameStep.propTypes = {onDone: PropTypes.func};

/**
 * The step a signed-in account still needs, or null when it's ready.
 * @param {?object} account The account.
 * @returns {?string} 'age', 'consent', 'name' or null.
 */
const nextProfileStep = account => {
    if (!account) return null;
    if (!account.birthYear) return 'age';
    if (ageFrom(account.birthMonth, account.birthYear) < 13 && !account.consent) return 'consent';
    if (!account.makerName) return 'name';
    return null;
};

/**
 * The account dialog. Mount once per page; it opens itself to finish sign-in links and unfinished
 * accounts, and when openAccountDialog() is called.
 * @returns {?React.ReactElement} The dialog, when open.
 */
const AccountDialog = () => {
    const account = useAccount();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('save');
    const [callback, setCallback] = useState(null);
    const [options, setOptions] = useState({google: false, signupOpen: false});
    const [dismissed, setDismissed] = useState(false);
    const [linkError, setLinkError] = useState('');
    const boxRef = useRef(null);

    useEffect(() => {
        const opener = why => {
            setReason(why);
            setDismissed(false);
            setOpen(true);
        };
        openers.add(opener);
        authOptions().then(setOptions);
        startAuth().then(() => {
            const pending = takePendingCallback();
            if (pending && pending.type === 'error') {
                // A sign-in link or Google sign-in that didn't work: say so.
                setLinkError(errorText(pending.error));
                setOpen(true);
            } else if (pending) {
                setCallback(pending);
                setOpen(true);
            }
        });
        return () => openers.delete(opener);
    }, []);

    // An account that isn't finished asks for the missing details (once per page, unless reopened).
    const profileStep = nextProfileStep(account);
    useEffect(() => {
        if (profileStep && !dismissed) setOpen(true);
    }, [profileStep, dismissed]);

    useEffect(() => {
        if (!open) return;
        const onKey = e => {
            if (e.key === 'Escape') {
                setOpen(false);
                setDismissed(true);
            }
        };
        document.addEventListener('keydown', onKey);
        if (boxRef.current) {
            const first = boxRef.current.querySelector('button, input, select');
            if (first) first.focus();
        }
        return () => document.removeEventListener('keydown', onKey);
    }, [open, callback, profileStep, !!account]);

    if (!open) return null;
    const close = () => {
        setOpen(false);
        setDismissed(true);
    };
    let step = 'choose';
    if (callback) step = 'password';
    else if (account) step = profileStep || 'done';

    let body;
    if (step === 'password') {
        body = (
            <PasswordStep
                callback={callback}
                onDone={() => setCallback(null)}
            />
        );
    } else if (step === 'choose') {
        body = (
            <ChooseStep
                reason={reason}
                options={options}
                initialError={linkError}
                onDone={() => {}}
            />
        );
    } else if (step === 'age') {
        body = <AgeStep onDone={() => {}} />;
    } else if (step === 'consent') {
        body = <ConsentStep onDone={() => {}} />;
    } else if (step === 'name') {
        body = <NameStep onDone={() => {}} />;
    } else {
        body = (
            <div className={styles.form}>
                <h2 className={styles.title}>{`HI, ${account.makerName.toUpperCase()}!`}</h2>
                <p className={styles.lede}>
                    {'You\'re all set. Games you make now save to your account, so you can open them anywhere.'}
                </p>
                <button
                    className={classNames(sj.btn, sj.btnWide)}
                    onClick={close}
                    type="button"
                >{'KEEP MAKING'}</button>
            </div>
        );
    }
    const progress = {choose: 0, password: 0, age: 1, consent: 1, name: 2, done: 3}[step];
    return (
        <div
            className={classNames(sj.tokens, styles.backdrop)}
            onClick={e => {
                if (e.target === e.currentTarget) close();
            }}
        >
            <div
                ref={boxRef}
                className={styles.box}
                role="dialog"
                aria-modal="true"
                aria-label="Your Sparkjam account"
            >
                <button
                    className={styles.close}
                    onClick={close}
                    aria-label="Close"
                    type="button"
                >{'✕'}</button>
                <div
                    className={styles.steps}
                    aria-hidden="true"
                >
                    {[0, 1, 2].map(i => (<i
                        key={i}
                        className={classNames({[styles.stepOn]: i <= progress})}
                    />))}
                </div>
                {body}
            </div>
        </div>
    );
};

/**
 * The signed-in maker in the nav: their name and a small menu, or a Sign in button.
 * @param {object} props Props.
 * @param {string} [props.className] Class for the Sign in button.
 * @returns {React.ReactElement} The control.
 */
const AccountButton = ({className}) => {
    const account = useAccount();
    const [menu, setMenu] = useState(false);
    if (!account || !isAccountReady(account)) {
        return (
            <button
                className={className}
                onClick={() => openAccountDialog('save')}
                type="button"
            >{account ? 'Finish your account' : 'Sign in'}</button>
        );
    }
    return (
        <div className={styles.me}>
            <button
                className={styles.meButton}
                onClick={() => setMenu(!menu)}
                aria-expanded={menu}
                type="button"
            >
                <span className={styles.avatar}>{account.makerName[0]}</span>
                {account.makerName}
                <span aria-hidden="true">{'▾'}</span>
            </button>
            {menu ? (
                <div className={styles.meMenu}>
                    <a href={links.myGames}>{'My games'}</a>
                    <button
                        type="button"
                        onClick={async () => {
                            setMenu(false);
                            await signOut();
                        }}
                    >{'Sign out'}</button>
                </div>
            ) : null}
        </div>
    );
};
AccountButton.propTypes = {className: PropTypes.string};

export {AccountDialog, AccountButton, openAccountDialog, useAccount};
