// Sparkjam: the jam chat filter. Messages are checked when sent and again when received (so a modified
// browser can't get around it). It blocks ways to contact someone outside Sparkjam (phone numbers,
// emails, addresses, social handles, links) and swaps rude words for stars.

const MAX_LENGTH = 200;

// Kept short and obvious; matched as whole words, ignoring case and simple letter swaps.
const RUDE = [
    'fuck', 'fucking', 'fucker', 'shit', 'shitty', 'bitch', 'bastard', 'cunt', 'dick', 'dickhead', 'piss',
    'pissed', 'wanker', 'twat', 'slut', 'whore', 'asshole', 'arsehole', 'bollocks', 'prick', 'cock', 'porn',
    'sex', 'sexy', 'nude', 'nudes', 'naked', 'retard', 'retarded', 'nigger', 'nigga', 'faggot', 'fag', 'spastic',
    'kys'
];

const unleet = text => text.toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't');

// A run of digits (with spaces, dots or dashes between) that looks like a phone number: 9 or more digits
// starting with 0 or +, or 10 or more digits written in groups. Game numbers like 1000000 are fine.
const looksLikePhone = text => (text.match(/\+?\d[\d\s.-]{6,}\d/g) || []).some(run => {
    const digits = run.replace(/\D/g, '');
    const grouped = /[\s.-]/.test(run);
    if (/^0+$|0{3,}$/.test(digits) && !grouped) return false;
    return (digits.length >= 9 && /^[+0]/.test(run)) || (digits.length >= 10 && grouped) || digits.length >= 11;
});

/* eslint-disable max-len */ // The patterns read best on one line each.
const CONTACT = [
    // Emails, including "name at gmail".
    {kind: 'email', pattern: /\S+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*(?:gmail|hotmail|outlook|yahoo|icloud|proton|live|aol|[a-z0-9-]+\.[a-z]{2,})/i},
    // Links and web addresses.
    {kind: 'link', pattern: /\b(?:https?:\/\/|www\.)\S+/i},
    {kind: 'link', pattern: /\b[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*(?:com|net|org|io|gg|tv|me|co|uk|app|xyz|ly|be|link)\b/i},
    // Phone numbers (see looksLikePhone).
    {kind: 'phone', test: text => looksLikePhone(text)},
    // Social handles and apps people use to move a chat elsewhere.
    {kind: 'social', pattern: /(?:^|\s)@[a-z0-9_.]{3,}/i},
    {kind: 'social', pattern: /\b(?:snap(?:chat)?|insta(?:gram)?|tiktok|discord|whatsapp|telegram|kik|wechat|facebook|fb|twitter|roblox\s*(?:user|name)?|skype|signal|steam\s*name)\b/i},
    // Home addresses and meeting up.
    {kind: 'address', pattern: /\b\d{1,4}\s+[a-z]+(?:\s+[a-z]+)?\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|way|crescent|court|place)\b/i},
    {kind: 'address', pattern: /\b[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}\b/i}, // UK postcode
    {kind: 'address', pattern: /\b(?:my|our)\s+(?:address|house\s+number|postcode|zip\s*code)\b/i},
    {kind: 'meet', pattern: /\b(?:meet\s+(?:me|up|irl)|come\s+to\s+my\s+house|where\s+do\s+you\s+live)\b/i}
/* eslint-enable max-len */
];

const REASONS = {
    link: 'Links can\'t be sent in jam chat.',
    email: 'Email addresses can\'t be sent in jam chat.',
    phone: 'Phone numbers can\'t be sent in jam chat.',
    social: 'Usernames for other apps can\'t be sent in jam chat.',
    address: 'Addresses can\'t be sent in jam chat. Keep where you live private.',
    meet: 'Jam chat is for making games. Never arrange to meet people from online.'
};

/**
 * Check a chat message.
 * @param {string} text What was typed.
 * @returns {{ok: boolean, text: string, reason: ?string}} ok false means don't send it (reason says why);
 *     otherwise text is the message with any rude words starred out.
 */
const filterChat = text => {
    const clean = String(text).replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_LENGTH);
    if (!clean) return {ok: false, text: '', reason: null};
    for (const {kind, pattern, test} of CONTACT) {
        if (test ? test(clean) : pattern.test(clean)) return {ok: false, text: clean, reason: REASONS[kind]};
    }
    const starred = clean.replace(/[a-z0-9@$!|]+/gi, word => {
        const plain = unleet(word).replace(/[^a-z]/g, '');
        const rude = RUDE.includes(plain) || RUDE.some(r => r.length > 4 && plain.startsWith(r));
        return rude ? '*'.repeat(word.length) : word;
    });
    return {ok: true, text: starred, reason: null};
};

export {filterChat, MAX_LENGTH};
