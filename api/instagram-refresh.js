// Refreshes the long-lived Instagram token before its 60-day expiry.
// Run monthly via Vercel cron (see vercel.json). Guarded by CRON_SECRET.
// NOTE: the refresh endpoint may return a NEW token string. Env vars can't be
// rewritten from a function, so at deploy time we either (a) store the live
// token in Supabase and have instagram-feed.js read it from there, or
// (b) paste the refreshed token into Vercel env when it rotates.
// Decide at launch — (a) is the set-and-forget option.

module.exports = async (req, res) => {
    if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return res.status(503).json({ error: 'Instagram not connected' });

    try {
        const r = await fetch('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' + encodeURIComponent(token));
        const data = await r.json();
        if (!r.ok) throw new Error(JSON.stringify(data));
        console.log('[instagram-refresh] token refreshed, expires_in:', data.expires_in);
        return res.status(200).json({ refreshed: true, expires_in: data.expires_in });
    } catch (err) {
        console.error('[instagram-refresh]', err.message);
        return res.status(502).json({ error: 'Refresh failed' });
    }
};
