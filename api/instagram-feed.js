// Prime Time Miami — live Instagram feed.
// Uses the official Instagram API (Instagram Login flavor, professional account).
// Env: INSTAGRAM_ACCESS_TOKEN (long-lived token; refreshed by /api/instagram-refresh cron).
// Returns the latest image posts; the client falls back to curated tiles if this fails.

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400');

    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) {
        return res.status(503).json({ error: 'Instagram not connected' });
    }

    try {
        const url = 'https://graph.instagram.com/me/media'
            + '?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp'
            + '&limit=18&access_token=' + encodeURIComponent(token);
        const r = await fetch(url);
        if (!r.ok) throw new Error('Instagram API ' + r.status);
        const data = await r.json();

        const posts = (data.data || [])
            .filter(p => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL_ALBUM' || p.media_type === 'VIDEO')
            .slice(0, 6)
            .map(p => ({
                id: p.id,
                image: p.media_type === 'VIDEO' ? (p.thumbnail_url || p.media_url) : p.media_url,
                permalink: p.permalink,
                caption: (p.caption || '').slice(0, 120),
            }));

        return res.status(200).json({ posts });
    } catch (err) {
        console.error('[instagram-feed]', err.message);
        return res.status(502).json({ error: 'Failed to fetch feed' });
    }
};
