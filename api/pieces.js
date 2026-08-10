// Public inventory feed. Reads Supabase when configured; the site falls back
// to /data/pieces.json when this returns 503 (pre-launch/local).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(503).json({ error: 'Backend not configured' });
    }
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/pieces?select=*&order=created_at.asc`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
        });
        if (!r.ok) throw new Error('supabase ' + r.status);
        const rows = await r.json();
        const pieces = rows.map(p => ({
            id: p.id, brand: p.brand, model: p.model, ref: p.ref, year: p.year,
            caseMaterial: p.case_material, dialColor: p.dial_color, condition: p.condition,
            description: p.description, image: p.image, featured: p.featured, sold: p.sold
        }));
        return res.status(200).json(pieces);
    } catch (err) {
        console.error('[pieces]', err.message);
        return res.status(502).json({ error: 'Failed to load pieces' });
    }
};
