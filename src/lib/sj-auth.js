// Sparkjam: accounts, using Netlify Identity (@netlify/identity). An account needs a maker name and
// a birth month and year before it can save; under-13s also need a parent's OK (a placeholder for
// now, see docs/ACCOUNTS.md). Pages call startAuth() once to finish sign-in links and keep everyone in sync.

import {
    getUser,
    getSettings,
    handleAuthCallback,
    onAuthChange,
    login,
    signup,
    logout,
    oauthLogin,
    updateUser,
    acceptInvite,
    requestPasswordRecovery
} from '@netlify/identity';

const listeners = new Set();
let current = null;
let started = null;
// A sign-in link that needs one more step from the person (choose a password).
let pendingCallback = null;

/**
 * The parts of a user Sparkjam uses.
 * @param {?object} user A user from @netlify/identity.
 * @returns {?object} {id, email, makerName, birthMonth, birthYear, consent, provider}, or null.
 */
const toAccount = user => {
    if (!user) return null;
    const data = user.userMetadata || {};
    return {
        id: user.id,
        email: user.email || '',
        provider: user.provider || 'email',
        makerName: typeof data.maker_name === 'string' ? data.maker_name : '',
        birthMonth: Number(data.birth_month) || 0,
        birthYear: Number(data.birth_year) || 0,
        consent: typeof data.consent === 'string' ? data.consent : ''
    };
};

/**
 * Age in whole years on today's date, from a birth month (1-12) and year.
 * @param {number} month Birth month.
 * @param {number} year Birth year.
 * @param {Date} [today] Today.
 * @returns {number} Age.
 */
const ageFrom = (month, year, today = new Date()) => {
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month) age -= 1;
    return age;
};

/**
 * Whether an account has finished setting up: it has a maker name, a birth date, and a parent's OK if
 * under 13.
 * @param {?object} account From toAccount.
 * @returns {boolean} True when the account can save and (later) jam.
 */
const isAccountReady = account => !!account && !!account.makerName && !!account.birthYear &&
    (ageFrom(account.birthMonth, account.birthYear) >= 13 || !!account.consent);

const emit = () => listeners.forEach(listener => listener(current));

const setCurrent = user => {
    current = toAccount(user);
    emit();
    return current;
};

/**
 * Start auth for this page: finish any sign-in, invite or password link in the address, then load the
 * signed-in user. Safe to call more than once.
 * @returns {Promise<?object>} The account, or null.
 */
const startAuth = () => {
    if (!started) {
        started = (async () => {
            try {
                const result = await handleAuthCallback();
                if (result && (result.type === 'invite' || result.type === 'recovery')) {
                    pendingCallback = result;
                }
            } catch (e) {
                pendingCallback = {type: 'error', error: e};
            }
            onAuthChange((event, user) => setCurrent(user));
            return setCurrent(await getUser());
        })();
    }
    return started;
};

const getAccount = () => current;

const onAccount = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** @returns {?object} A pending invite or password-reset link, once. */
const takePendingCallback = () => {
    const result = pendingCallback;
    pendingCallback = null;
    return result;
};

/**
 * Sign-in options for this site.
 * @returns {Promise<object>} {signupOpen, google}.
 */
const authOptions = async () => {
    try {
        const settings = await getSettings();
        return {
            signupOpen: !settings.disableSignup,
            google: !!(settings.providers && settings.providers.google)
        };
    } catch (e) {
        return {signupOpen: false, google: false, unavailable: true};
    }
};

const signInWithEmail = async (email, password) => setCurrent(await login(email, password));
const signUpWithEmail = async (email, password) => {
    const user = await signup(email, password);
    // With email confirmation on, the account exists but isn't signed in until the link is used.
    if (!user || !user.confirmedAt) return null;
    return setCurrent(await getUser());
};
const signInWithGoogle = () => oauthLogin('google');
const finishInvite = async (token, password) => setCurrent(await acceptInvite(token, password));
const setNewPassword = async password => setCurrent(await updateUser({password}));
const sendPasswordReset = email => requestPasswordRecovery(email);
const signOut = async () => {
    await logout();
    setCurrent(null);
};

/**
 * Save profile details (maker name, birth month and year, consent) to the account.
 * @param {object} data Fields to set, eg. {maker_name: 'PixelFox42'}.
 * @returns {Promise<object>} The updated account.
 */
const updateProfile = async data => setCurrent(await updateUser({data}));

export {
    startAuth,
    getAccount,
    onAccount,
    takePendingCallback,
    authOptions,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    finishInvite,
    setNewPassword,
    sendPasswordReset,
    signOut,
    updateProfile,
    isAccountReady,
    ageFrom
};
