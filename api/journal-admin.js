// Prime Time Miami journal admin API (auth-protected CRUD + image upload).
// POST /api/journal-admin  body: { action, token, ...args }
//   action: "list-all" | "get" | "save" | "delete" | "upload-image"
// Auth: the same signed session token /api/admin issues at login (ADMIN_SECRET HMAC).
// Env: ADMIN_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const crypto = require("crypto");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function verify(token) {
    if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
    const [body, mac] = token.split(".");
    const expect = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (mac.length !== expect.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
}

function slugify(text) {
    return String(text).toLowerCase().trim()
        .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);
}

function readingTimeMinutes(plainText) {
    const words = String(plainText || "").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
}

// ── Editor.js JSON to HTML (sanitised) ──────────────────────────

function escHtml(s) {
    return String(s || "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Editor.js sends real HTML for inline formatting. Allow a short list of inline
// tags, strip every attribute except a safe href, neuter everything else.
const INLINE_OK = new Set(["b", "strong", "i", "em", "u", "s", "mark", "code", "br", "a"]);

function sanitizeInline(html) {
    if (html == null) return "";
    let out = String(html);
    out = out.replace(/<(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\/\1\s*>/gi, "");
    out = out.replace(/<(script|style|iframe|object|embed|svg|math|template)\b[^>]*\/?>/gi, "");
    return out.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (tag, name, attrs) => {
        const n = String(name).toLowerCase();
        if (!INLINE_OK.has(n)) return escHtml(tag);
        if (tag.startsWith("</")) return `</${n}>`;
        if (n !== "a") return `<${n}>`;
        const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || "");
        const url = href ? (href[2] ?? href[3] ?? href[4] ?? "").trim() : "";
        if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) return "<a>";
        return `<a href="${escHtml(url)}" rel="noopener nofollow" target="_blank">`;
    });
}

function renderBlock(block, fallbackAlt) {
    const { type, data } = block || {};
    if (!type || !data) return "";
    switch (type) {
        case "paragraph":
            return `<p>${sanitizeInline(data.text)}</p>`;
        case "header": {
            const level = Math.min(Math.max(parseInt(data.level, 10) || 2, 2), 4);
            return `<h${level}>${sanitizeInline(data.text)}</h${level}>`;
        }
        case "list": {
            const tag = data.style === "ordered" ? "ol" : "ul";
            const items = Array.isArray(data.items) ? data.items : [];
            const lis = items.map((it) => `<li>${sanitizeInline(typeof it === "string" ? it : (it && it.content) || "")}</li>`).join("");
            return `<${tag}>${lis}</${tag}>`;
        }
        case "quote": {
            const caption = data.caption ? `<footer>${sanitizeInline(data.caption)}</footer>` : "";
            return `<blockquote>${sanitizeInline(data.text)}${caption}</blockquote>`;
        }
        case "image": {
            const url = (data.file && data.file.url) || data.url || "";
            if (!url || !/^https?:\/\//i.test(url)) return "";
            const captionText = String(data.caption || "").replace(/<[^>]+>/g, "").trim();
            const alt = escHtml(captionText || fallbackAlt || "");
            const caption = captionText ? `<figcaption>${escHtml(captionText)}</figcaption>` : "";
            return `<figure class="journal-figure"><img src="${escHtml(url)}" alt="${alt}" loading="lazy" />${caption}</figure>`;
        }
        case "embed": {
            const url = data.embed || data.source || "";
            if (!url || !/^https:\/\//i.test(url)) return "";
            return `<div class="journal-embed"><iframe src="${escHtml(url)}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        case "code":
            return `<pre class="journal-code"><code>${escHtml(data.code || "")}</code></pre>`;
        case "delimiter":
            return `<hr class="journal-delimiter" />`;
        default:
            return "";
    }
}

function renderEditorJson(json, fallbackAlt) {
    if (!json || !Array.isArray(json.blocks)) return "";
    return json.blocks.map((b) => renderBlock(b, fallbackAlt)).join("\n");
}

function plainTextFromJson(json) {
    if (!json || !Array.isArray(json.blocks)) return "";
    return json.blocks.map((b) => {
        if (!b || !b.data) return "";
        if (b.type === "paragraph" || b.type === "header" || b.type === "quote") return String(b.data.text || "").replace(/<[^>]+>/g, "");
        if (b.type === "list") return (b.data.items || []).map((it) => (typeof it === "string" ? it : (it && it.content) || "")).join(" ").replace(/<[^>]+>/g, "");
        return "";
    }).join(" ");
}

// ── Supabase helpers ────────────────────────────────────────────

async function sb(path, init = {}) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
        ...init,
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
            ...(init.headers || {}),
        },
    });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 300)}`);
    if (r.status === 204) return null;
    return r.json();
}

async function uploadToStorage({ bucket, path, base64Data, contentType }) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": contentType, "x-upsert": "false" },
        body: Buffer.from(base64Data, "base64"),
    });
    if (!r.ok) throw new Error(`Storage upload ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

// ── Actions ─────────────────────────────────────────────────────

async function actionListAll() {
    const fields = "id,slug,title,subtitle,status,category,published_at,created_at,updated_at,hero_image_url,view_count";
    const rows = await sb(`/journal_articles?select=${fields}&order=updated_at.desc&limit=200`);
    return { articles: rows };
}

async function actionGet({ id }) {
    if (!id) throw new Error("Missing id");
    const rows = await sb(`/journal_articles?id=eq.${encodeURIComponent(id)}&limit=1`);
    if (!rows || rows.length === 0) throw new Error("Article not found");
    return { article: rows[0] };
}

async function actionSave(b) {
    const { id, title, subtitle, excerpt, category, hero_image_url, hero_alt, content_json, seo_title, seo_description, status, published_at } = b;
    if (!title || !String(title).trim()) throw new Error("Title required");

    const trimmedTitle = String(title).trim();
    const html = renderEditorJson(content_json, trimmedTitle);
    const plain = plainTextFromJson(content_json);

    const payload = {
        title: trimmedTitle,
        subtitle: subtitle ? String(subtitle).trim() : null,
        excerpt: excerpt ? String(excerpt).trim() : (plain ? plain.slice(0, 220).trim() : null),
        category: category ? String(category).trim() : null,
        hero_image_url: hero_image_url || null,
        hero_alt: hero_alt ? String(hero_alt).trim() : null,
        content_json: content_json || null,
        content_html: html,
        seo_title: seo_title || null,
        seo_description: seo_description || null,
        reading_time_minutes: readingTimeMinutes(plain),
    };

    // Explicit article date from the editor. "" clears it; a valid date sets it.
    if (published_at !== undefined) {
        if (!published_at) payload.published_at = null;
        else {
            const d = new Date(published_at);
            if (!isNaN(d.getTime())) payload.published_at = d.toISOString();
        }
    }
    if (status === "published" || status === "draft" || status === "archived") {
        payload.status = status;
        if (status === "published" && !payload.published_at) payload.published_at = new Date().toISOString();
    }

    if (id) {
        const updated = await sb(`/journal_articles?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload),
        });
        return { article: updated[0] };
    }

    // Create with a unique slug
    const baseSlug = slugify(trimmedTitle) || `article-${Date.now()}`;
    let slug = baseSlug;
    const existing = await sb(`/journal_articles?slug=eq.${encodeURIComponent(slug)}&select=id`);
    if (existing && existing.length > 0) slug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
    payload.slug = slug;
    if (!payload.status) payload.status = "draft";

    const created = await sb(`/journal_articles`, {
        method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload),
    });
    return { article: created[0] };
}

async function actionDelete({ id }) {
    if (!id) throw new Error("Missing id");
    await sb(`/journal_articles?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    return { deleted: true };
}

async function actionUploadImage({ filename, data, contentType }) {
    if (!data || !contentType) throw new Error("Missing image data or contentType");
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowed.includes(contentType)) throw new Error("Unsupported image type");
    const ext = contentType.split("/")[1].replace("jpeg", "jpg");
    const safeName = (filename || "image").replace(/[^a-z0-9.-]/gi, "-").slice(0, 60);
    const date = new Date().toISOString().slice(0, 10);
    const rand = crypto.randomBytes(6).toString("hex");
    const path = `${date}/${rand}-${safeName.replace(/\.[^.]+$/, "")}.${ext}`;
    const url = await uploadToStorage({ bucket: "journal-images", path, base64Data: data, contentType });
    // Editor.js Image tool expects { success: 1, file: { url } }
    return { success: 1, file: { url } };
}

// ── Handler ─────────────────────────────────────────────────────

module.exports = async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    if (!SUPABASE_URL || !SUPABASE_KEY || !ADMIN_SECRET) return res.status(503).json({ error: "Backend not configured yet" });

    let session;
    try { session = verify((req.body || {}).token); } catch { session = null; }
    if (!session) return res.status(401).json({ error: "Session expired. Log in again." });

    try {
        const body = req.body || {};
        switch (body.action) {
            case "list-all": return res.status(200).json(await actionListAll());
            case "get": return res.status(200).json(await actionGet(body));
            case "save": return res.status(200).json(await actionSave(body));
            case "delete": return res.status(200).json(await actionDelete(body));
            case "upload-image": return res.status(200).json(await actionUploadImage(body));
            default: return res.status(400).json({ error: "Unknown action" });
        }
    } catch (err) {
        console.error("[journal-admin]", err.message);
        return res.status(500).json({ error: err.message || "Server error" });
    }
};
