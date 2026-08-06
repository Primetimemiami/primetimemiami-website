// Prime Time Miami — admin API (login + inventory CRUD against Supabase).
// Env: ADMIN_PASSWORD, ADMIN_SECRET (any long random string),
//      SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const configured = () => SUPABASE_URL && SUPABASE_KEY && ADMIN_PASSWORD && ADMIN_SECRET;

function sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const mac = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
    return body + '.' + mac;
}
function verify(token) {
    if (!token || token.indexOf('.') < 0) return null;
    const [body, mac] = token.split('.');
    const expect = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
}

async function sb(path, opts = {}) {
    const r = await fetch(`${SUPABASE_URL}${path}`, {
        ...opts,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            ...(opts.headers || {})
        }
    });
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r;
}

const toRow = p => ({
    id: p.id, brand: p.brand || '', model: p.model || '', ref: p.ref || '', year: p.year || '',
    case_material: p.caseMaterial || '', dial_color: p.dialColor || '', condition: p.condition || '',
    description: p.description || '', image: p.image || '',
    featured: !!p.featured, sold: !!p.sold, updated_at: new Date().toISOString()
});

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const { action } = req.body || {};

    if (action === 'status') {
        return res.status(200).json({ configured: !!configured() });
    }
    if (!configured()) {
        return res.status(503).json({ error: 'Backend not configured yet' });
    }

    if (action === 'login') {
        const pw = String(req.body.password || '');
        const ok = pw.length > 0 && ADMIN_PASSWORD.length > 0 &&
            pw.length === ADMIN_PASSWORD.length &&
            crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(ADMIN_PASSWORD));
        if (!ok) return res.status(401).json({ error: 'Wrong password' });
        return res.status(200).json({ token: sign({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 24 * 30 }) });
    }

    // everything below requires a valid token
    let session;
    try { session = verify(req.body.token); } catch { session = null; }
    if (!session) return res.status(401).json({ error: 'Session expired — log in again' });

    try {
        if (action === 'list') {
            const r = await sb('/rest/v1/pieces?select=*&order=created_at.asc');
            return res.status(200).json({ pieces: await r.json() });
        }

        if (action === 'upload') {
            // body: { filename, contentType, dataBase64 }
            const { filename, contentType, dataBase64 } = req.body;
            const safe = String(filename || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '');
            const key = Date.now() + '-' + safe;
            await sb(`/storage/v1/object/pieces/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': contentType || 'image/jpeg' },
                body: Buffer.from(dataBase64, 'base64')
            });
            return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1/object/public/pieces/${key}` });
        }

        if (action === 'save') {
            const p = req.body.piece || {};
            if (!p.id || !p.brand || !p.model) return res.status(400).json({ error: 'id, brand and model are required' });
            await sb('/rest/v1/pieces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
                body: JSON.stringify(toRow(p))
            });
            return res.status(200).json({ ok: true });
        }

        if (action === 'delete') {
            const id = String(req.body.id || '');
            if (!id) return res.status(400).json({ error: 'id required' });
            await sb(`/rest/v1/pieces?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
        console.error('[admin]', err.message);
        return res.status(502).json({ error: 'Backend error — try again' });
    }
};
