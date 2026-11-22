// Sparkjam: games saved to an account, in Netlify Blobs. Only the signed-in maker can reach their games.
//
//   GET    /api/games          list my games (no project data)
//   GET    /api/games/:id      download one game's .sb3
//   PUT    /api/games/:id      save a game: multipart form with sb3 (file), title and thumbnail (data URL)
//   DELETE /api/games/:id      delete a game
//
// Accounts must have finished setting up (maker name, birth date, and a parent's OK for under-13s).

import {getStore} from '@netlify/blobs';
import {currentUser, isReady} from '../lib/account.mjs';

const MAX_GAME_BYTES = 5 * 1024 * 1024;
const MAX_THUMBNAIL_CHARS = 200 * 1024;
const MAX_GAMES = 200;
const ID = /^[a-f0-9]{8,32}$/;

const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control': 'no-store'}});

const metaKey = (userId, id) => `${userId}/meta/${id}`;
const dataKey = (userId, id) => `${userId}/sb3/${id}`;

export default async req => {
    const user = await currentUser(req);
    if (!user) return json({error: 'Sign in to save games to your account.'}, 401);
    if (!isReady(user)) return json({error: 'Finish setting up your account first.'}, 403);

    const store = getStore({name: 'sparkjam-games', consistency: 'strong'});
    const id = new URL(req.url).pathname.split('/')
        .filter(Boolean)[2] || null;
    if (id && !ID.test(id)) return json({error: 'Unknown game.'}, 404);

    if (req.method === 'GET' && !id) {
        const {blobs} = await store.list({prefix: `${user.id}/meta/`});
        const games = (await Promise.all(blobs.map(blob => store.get(blob.key, {type: 'json'}))))
            .filter(Boolean)
            .sort((a, b) => b.updatedAt - a.updatedAt);
        return json({games});
    }

    if (req.method === 'GET') {
        const data = await store.get(dataKey(user.id, id), {type: 'arrayBuffer'});
        if (!data) return json({error: 'Unknown game.'}, 404);
        return new Response(data, {headers: {'Content-Type': 'application/x.scratch.sb3', 'Cache-Control': 'no-store'}});
    }

    if (req.method === 'PUT' && id) {
        let form;
        try {
            form = await req.formData();
        } catch (e) {
            return json({error: 'That save didn\'t arrive properly.'}, 400);
        }
        const file = form.get('sb3');
        if (!file || typeof file.arrayBuffer !== 'function') return json({error: 'No game to save.'}, 400);
        if (file.size > MAX_GAME_BYTES) {
            return json({error: 'This game is too big to save online (5 MB max). It\'s still saved on this device.'},
                413);
        }
        const title = String(form.get('title') || 'Untitled game').slice(0, 100);
        let thumbnail = String(form.get('thumbnail') || '');
        if (!thumbnail.startsWith('data:image/') || thumbnail.length > MAX_THUMBNAIL_CHARS) thumbnail = '';

        const existing = await store.get(metaKey(user.id, id), {type: 'json'});
        if (!existing) {
            const {blobs} = await store.list({prefix: `${user.id}/meta/`});
            if (blobs.length >= MAX_GAMES) return json({error: 'You\'ve saved the most games an account can hold.'}, 409);
        }
        const now = Date.now();
        const meta = {
            id,
            title,
            thumbnail,
            size: file.size,
            createdAt: existing ? existing.createdAt : now,
            updatedAt: now
        };
        await store.set(dataKey(user.id, id), await file.arrayBuffer());
        await store.setJSON(metaKey(user.id, id), meta);
        return json({game: meta});
    }

    if (req.method === 'DELETE' && id) {
        await store.delete(dataKey(user.id, id));
        await store.delete(metaKey(user.id, id));
        return json({deleted: id});
    }

    return json({error: 'Not found.'}, 404);
};

export const config = {
    path: ['/api/games', '/api/games/:id']
};
