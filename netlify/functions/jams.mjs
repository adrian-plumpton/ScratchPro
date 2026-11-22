// Sparkjam: jams. A jam is a game several makers build live. The code (JAM-4827) is the invite; only
// signed-in makers with finished accounts can use one. Live editing goes through Liveblocks (see
// jam-auth.mjs); this keeps the register of jams and the latest copy of each jam's game.
//
//   POST   /api/jams                    start a jam: multipart form with sb3 (file) and title
//   GET    /api/jams/:code              the jam's details (joining checks this first)
//   GET    /api/jams/:code/snapshot     the latest copy of the game
//   PUT    /api/jams/:code/snapshot     replace it (any member): multipart form with sb3
//   POST   /api/jams/:code/remove       host only: {userId} can't rejoin
//   DELETE /api/jams/:code              host only: end the jam; the code stops working

import crypto from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {getUser} from '@netlify/identity';

const MAX_GAME_BYTES = 5 * 1024 * 1024;
const MAX_LOOKUPS_PER_HOUR = 30;
const CODE = /^\d{4}$/;

const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

const ageFrom = (month, year, today = new Date()) => {
    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month) age -= 1;
    return age;
};

const isReady = user => {
    const data = user.userMetadata || {};
    const year = Number(data.birth_year);
    if (!data.maker_name || !year) return false;
    return ageFrom(Number(data.birth_month) || 1, year) >= 13 || !!data.consent;
};

const jamKey = code => `jams/${code}`;
const snapshotKey = code => `snapshots/${code}`;

// Codes are short, so limit how many a maker can look up, to stop guessing.
const allowLookup = async (store, userId) => {
    const key = `lookups/${userId}`;
    const now = Date.now();
    const record = await store.get(key, {type: 'json'});
    const fresh = !record || now - record.windowStart > 60 * 60 * 1000;
    const next = fresh ? {windowStart: now, count: 1} : {...record, count: record.count + 1};
    await store.setJSON(key, next);
    return next.count <= MAX_LOOKUPS_PER_HOUR;
};

const readGame = async req => {
    let form;
    try {
        form = await req.formData();
    } catch (e) {
        return {error: json({error: 'That didn\'t arrive properly.'}, 400)};
    }
    const file = form.get('sb3');
    if (!file || typeof file.arrayBuffer !== 'function') return {error: json({error: 'No game was sent.'}, 400)};
    if (file.size > MAX_GAME_BYTES) return {error: json({error: 'This game is too big to jam on (5 MB max).'}, 413)};
    return {data: await file.arrayBuffer(), title: String(form.get('title') || 'Untitled game').slice(0, 100)};
};

const publicJam = (jam, userId) => ({
    code: jam.code,
    roomId: jam.roomId,
    title: jam.title,
    hostName: jam.hostName,
    isHost: jam.hostId === userId,
    createdAt: jam.createdAt
});

export default async req => {
    const user = await getUser();
    if (!user) return json({error: 'Sign in to jam.', reason: 'signin'}, 401);
    if (!isReady(user)) return json({error: 'Finish setting up your account to jam.', reason: 'signin'}, 403);
    const makerName = String(user.userMetadata.maker_name);

    const store = getStore({name: 'sparkjam-jams', consistency: 'strong'});
    const parts = new URL(req.url).pathname.split('/')
        .filter(Boolean); // ['api', 'jams', code?, action?]
    const code = parts[2] || null;
    const action = parts[3] || null;

    // Start a jam.
    if (req.method === 'POST' && !code) {
        const game = await readGame(req);
        if (game.error) return game.error;
        let newCode = null;
        for (let i = 0; i < 20 && !newCode; i++) {
            const candidate = String(crypto.randomInt(1000, 10000));
            const existing = await store.get(jamKey(candidate), {type: 'json'});
            if (!existing || existing.ended) newCode = candidate;
        }
        if (!newCode) return json({error: 'Couldn\'t find a free jam code. Try again in a moment.'}, 503);
        const jam = {
            code: newCode,
            roomId: `jam-${newCode}-${crypto.randomBytes(8).toString('hex')}`,
            title: game.title,
            hostId: user.id,
            hostName: makerName,
            createdAt: Date.now(),
            ended: false,
            removed: []
        };
        await store.set(snapshotKey(newCode), game.data);
        await store.setJSON(jamKey(newCode), jam);
        return json({jam: publicJam(jam, user.id)});
    }

    if (!code || !CODE.test(code)) return json({error: 'That isn\'t a jam code.'}, 404);
    const jam = await store.get(jamKey(code), {type: 'json'});
    const isHost = jam && jam.hostId === user.id;

    if (req.method === 'GET' && !action) {
        if (!isHost && !(await allowLookup(store, user.id))) {
            return json({error: 'Too many jam codes tried. Wait a while and try again.'}, 429);
        }
    }
    if (!jam || jam.ended) return json({error: 'That jam code doesn\'t work. The jam may have ended.'}, 404);
    if (jam.removed.includes(user.id)) return json({error: 'You can\'t rejoin this jam.'}, 403);

    if (req.method === 'GET' && !action) return json({jam: publicJam(jam, user.id)});

    if (action === 'snapshot' && req.method === 'GET') {
        const data = await store.get(snapshotKey(code), {type: 'arrayBuffer'});
        if (!data) return json({error: 'This jam has no game yet.'}, 404);
        return new Response(data, {headers: {'Content-Type': 'application/x.scratch.sb3', 'Cache-Control': 'no-store'}});
    }

    if (action === 'snapshot' && req.method === 'PUT') {
        const game = await readGame(req);
        if (game.error) return game.error;
        await store.set(snapshotKey(code), game.data);
        return json({saved: true});
    }

    if (action === 'remove' && req.method === 'POST') {
        if (!isHost) return json({error: 'Only the person who started the jam can remove people.'}, 403);
        const {userId} = await req.json().catch(() => ({}));
        if (typeof userId !== 'string' || userId === user.id) return json({error: 'Choose someone to remove.'}, 400);
        if (!jam.removed.includes(userId)) jam.removed.push(userId);
        await store.setJSON(jamKey(code), jam);
        return json({removed: userId});
    }

    if (!action && req.method === 'DELETE') {
        if (!isHost) return json({error: 'Only the person who started the jam can end it.'}, 403);
        await store.setJSON(jamKey(code), {...jam, ended: true, endedAt: Date.now()});
        await store.delete(snapshotKey(code));
        return json({ended: code});
    }

    return json({error: 'Not found.'}, 404);
};

export const config = {
    path: ['/api/jams', '/api/jams/:code', '/api/jams/:code/:action']
};
