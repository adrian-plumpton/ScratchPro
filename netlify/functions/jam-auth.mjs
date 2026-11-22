// Sparkjam: lets a signed-in jam member into the jam's Liveblocks room. Called by the Liveblocks client
// (authEndpoint) with {room}. Needs the LIVEBLOCKS_SECRET_KEY environment variable on Netlify.

import {Liveblocks} from '@liveblocks/node';
import {getStore} from '@netlify/blobs';
import {currentUser, isReady} from '../lib/account.mjs';

const COLORS = ['#ff2e88', '#36f9c6', '#ffe14d', '#c9a7ff', '#ffb347', '#7fe8f5', '#9be870', '#ff9466'];

const colorFor = id => {
    let hash = 0;
    for (const ch of id) hash = ((hash * 31) + ch.charCodeAt(0)) >>> 0;
    return COLORS[hash % COLORS.length];
};

export default async req => {
    if (req.method !== 'POST') return new Response('Not found', {status: 404});
    const secret = process.env.LIVEBLOCKS_SECRET_KEY;
    if (!secret) return Response.json({error: 'Jams aren\'t set up on this site yet.'}, {status: 503});
    const user = await currentUser(req);
    if (!user || !isReady(user)) return Response.json({error: 'Sign in to jam.'}, {status: 401});

    const {room} = await req.json().catch(() => ({}));
    const match = /^jam-(\d{4})-[a-f0-9]{16}$/.exec(String(room));
    if (!match) return Response.json({error: 'Unknown jam.'}, {status: 404});
    const store = getStore({name: 'sparkjam-jams', consistency: 'strong'});
    const jam = await store.get(`jams/${match[1]}`, {type: 'json'});
    if (!jam || jam.ended || jam.roomId !== room) return Response.json({error: 'That jam has ended.'}, {status: 404});
    if (jam.removed.includes(user.id)) return Response.json({error: 'You can\'t rejoin this jam.'}, {status: 403});

    const liveblocks = new Liveblocks({secret});
    const session = liveblocks.prepareSession(user.id, {
        userInfo: {
            name: String(user.userMetadata.maker_name),
            color: colorFor(user.id),
            host: jam.hostId === user.id
        }
    });
    session.allow(room, session.FULL_ACCESS);
    const {status, body} = await session.authorize();
    return new Response(body, {status, headers: {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}});
};

export const config = {
    path: '/api/jam-auth'
};
