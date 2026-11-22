// Sparkjam: the signed-in maker, for Netlify Functions, with their current account details.
//
// @netlify/identity's getUser() can fall back to the copy of the account inside the sign-in token, which
// is from when they signed in, so it misses details added since (eg. the maker name chosen right after
// signing up). When that copy looks unfinished, ask Identity for the current account.

import {getUser} from '@netlify/identity';

const ageFrom = (month, year, today = new Date()) => {
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month) age -= 1;
    return age;
};

const isReady = user => {
    const data = (user && user.userMetadata) || {};
    const year = Number(data.birth_year);
    if (!data.maker_name || !year) return false;
    return ageFrom(Number(data.birth_month) || 1, year) >= 13 || !!data.consent;
};

const tokenFrom = req => {
    const auth = req.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    const cookie = (req.headers.get('cookie') || '').split(/;\s*/)
        .find(part => part.startsWith('nf_jwt='));
    return cookie ? decodeURIComponent(cookie.slice('nf_jwt='.length)) : null;
};

/**
 * @param {Request} req The request.
 * @returns {Promise<?object>} The signed-in user ({id, email, userMetadata}), or null.
 */
const currentUser = async req => {
    const user = await getUser();
    if (!user || isReady(user)) return user;
    const token = tokenFrom(req);
    if (!token) return user;
    try {
        const response = await fetch(new URL('/.netlify/identity/user', req.url), {
            headers: {Authorization: `Bearer ${token}`}
        });
        if (!response.ok) return user;
        const fresh = await response.json();
        if (fresh.id !== user.id) return user;
        return {...user, userMetadata: fresh.user_metadata || user.userMetadata};
    } catch (e) {
        return user;
    }
};

export {currentUser, isReady, ageFrom};
