// Sparkjam: reports from jam chat. A maker reports someone; the report (with the recent chat lines)
// is kept in Netlify Blobs (store "sparkjam-reports") for a grown-up to review.

import {getStore} from '@netlify/blobs';
import {currentUser, isReady} from '../lib/account.mjs';

const REASONS = ['mean', 'rude', 'personal-info', 'uncomfortable', 'other'];

export default async req => {
    if (req.method !== 'POST') return new Response('Not found', {status: 404});
    const user = await currentUser(req);
    if (!user || !isReady(user)) return Response.json({error: 'Sign in to report.'}, {status: 401});
    const body = await req.json().catch(() => null);
    if (!body || !/^\d{4}$/.test(String(body.code)) || !REASONS.includes(body.reason)) {
        return Response.json({error: 'That report was missing something.'}, {status: 400});
    }
    const messages = Array.isArray(body.messages) ? body.messages.slice(-30).map(m => ({
        name: String(m.name || '').slice(0, 40),
        text: String(m.text || '').slice(0, 200),
        at: Number(m.at) || 0
    })) : [];
    const report = {
        at: new Date().toISOString(),
        jam: String(body.code),
        reason: body.reason,
        details: String(body.details || '').slice(0, 500),
        reporter: {id: user.id, name: String(user.userMetadata.maker_name || '')},
        reported: {id: String(body.reportedId || '').slice(0, 64), name: String(body.reportedName || '').slice(0, 40)},
        messages
    };
    const store = getStore({name: 'sparkjam-reports', consistency: 'strong'});
    await store.setJSON(`reports/${Date.now()}-${user.id}`, report);
    return Response.json({reported: true});
};

export const config = {
    path: '/api/jam-report'
};
