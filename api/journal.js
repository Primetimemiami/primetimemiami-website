// Prime Time Miami journal, public read API.
//   GET /api/journal                 published articles for the /journal index
//   GET /api/journal?slug=my-post    one published article
// Query params on the list: ?limit=20 (cap 50), ?offset=0, ?category=Market
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const LIST_FIELDS = [
    "id", "slug", "title", "subtitle", "excerpt", "hero_image_url", "hero_alt",
    "category", "author_name", "published_at", "reading_time_minutes",
].join(",");

async function sbGet(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
}

module.exports = async (req, res) => {
    if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(503).json({ error: "Journal not configured yet", articles: [] });

    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");

    try {
        const slug = req.query.slug ? String(req.query.slug).trim() : "";
        if (slug) {
            if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ error: "Bad slug" });
            const rows = await sbGet(`/journal_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
            if (!rows.length) return res.status(404).json({ error: "Not found" });
            return res.status(200).json({ article: rows[0] });
        }

        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        let path = `/journal_articles?select=${LIST_FIELDS}&status=eq.published&order=published_at.desc&limit=${limit}&offset=${offset}`;
        if (req.query.category) path += `&category=eq.${encodeURIComponent(String(req.query.category))}`;

        const articles = await sbGet(path);
        return res.status(200).json({ articles, count: articles.length });
    } catch (err) {
        console.error("[journal]", err.message);
        return res.status(500).json({ error: "Failed to load journal", articles: [] });
    }
};
