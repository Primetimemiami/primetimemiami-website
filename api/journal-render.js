// Server-side renderer for individual journal articles.
// Routed via vercel.json: /journal/:slug -> /api/journal-render?slug=:slug
// Returns full HTML so search engines get the article in the first response.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SITE_URL = "https://primetimemiami.com";
const OG_FALLBACK = `${SITE_URL}/images/og-share.png?v=2`;

function escHtml(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatPubDate(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return ""; }
}

const HEAD_COMMON = `
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=2" />
<link rel="shortcut icon" href="/favicon.png?v=2" />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..700;1,6..96,400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/dist/styles.css?v=31">
<style>
.pa-page{padding:40px 0 110px;color:#fff}
.pa-page .container{max-width:820px;margin:0 auto;padding:0 24px}
a.pa-crumb{font-size:11px;letter-spacing:.16em;color:rgba(255,255,255,.45);display:inline-block;margin-bottom:26px;text-decoration:none;transition:color .25s ease}
a.pa-crumb:hover{color:#fff}
.pa-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.45);margin:0 0 18px}
.pa-title{font-weight:700;font-size:clamp(34px,5vw,60px);line-height:1.04;letter-spacing:-.02em;margin:0 0 16px}
.pa-sub{font-size:15px;line-height:1.7;color:rgba(255,255,255,.6);margin:0 0 34px;max-width:640px}
.pa-hero{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;margin:0 0 14px;background:rgba(255,255,255,.04)}
.pa-heroline{display:flex;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.14);padding:0 0 14px;margin:0 0 40px;font-size:10px;letter-spacing:.2em;color:rgba(255,255,255,.45)}
.pa-heroline .didone{font-family:'Didot','Bodoni 72','Bodoni Moda','Bodoni MT',serif !important;font-style:italic;font-size:14px;letter-spacing:.02em;color:rgba(255,255,255,.7)}
.pa-body{font-size:16px;line-height:1.85;color:rgba(255,255,255,.82)}
.pa-body > * + *{margin-top:22px}
.pa-body p{margin:0}
.pa-body h2,.pa-body h3,.pa-body h4{font-weight:700;letter-spacing:-.02em;line-height:1.1;margin-top:46px;color:#fff}
.pa-body h2{font-size:28px}
.pa-body h3{font-size:22px}
.pa-body h4{font-size:17px}
.pa-body a{color:#fff;text-decoration:underline;text-underline-offset:4px}
.pa-body strong{color:#fff}
.pa-body mark{background:#fff;color:#000;padding:0 3px}
.pa-body ul,.pa-body ol{padding-left:22px}
.pa-body li{margin:6px 0}
.pa-body blockquote{border-left:2px solid #fff;margin:34px 0;padding:4px 0 4px 22px;font-size:18px;color:#fff;font-family:'Didot','Bodoni 72','Bodoni Moda','Bodoni MT',serif !important;font-style:italic}
.pa-body blockquote footer{font-family:'Helvetica Neue',Helvetica,'Instrument Sans',Arial,sans-serif !important;font-style:normal;font-size:11px;letter-spacing:.14em;color:rgba(255,255,255,.45);margin-top:8px}
.pa-body figure.journal-figure{margin:34px 0}
.pa-body figure img{width:100%;display:block}
.pa-body figcaption{font-size:10px;letter-spacing:.16em;color:rgba(255,255,255,.45);margin-top:10px}
.pa-body pre.journal-code{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);padding:16px;overflow-x:auto;font-size:13px}
.pa-body hr.journal-delimiter{border:none;height:1px;background:rgba(255,255,255,.14);margin:40px 0}
.pa-body .journal-embed iframe{width:100%;aspect-ratio:16/9;border:0}
.pa-cta{border-top:1px solid rgba(255,255,255,.12);margin-top:70px;padding-top:44px;text-align:center}
.pa-cta h3{font-weight:700;font-size:22px;letter-spacing:-.01em;margin:0 0 8px}
.pa-cta p{font-size:13px;color:rgba(255,255,255,.55);margin:0 0 22px}
.pa-cta .row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
@media(max-width:640px){.pa-page{padding:24px 0 80px}.pa-title{font-size:clamp(30px,9vw,44px)}}
</style>`;

function navHtml() {
    return `
    <nav class="w-full z-40 px-6 sm:px-10 md:px-16 py-5 sm:py-6 flex justify-between items-center relative">
        <a href="/"><img src="/images/logo.png" alt="Prime Time Miami" class="h-8 sm:h-10 w-auto object-contain"></a>
        <div class="hidden md:flex space-x-8 text-sm font-space font-medium uppercase tracking-widest items-center">
            <a href="/inventory" class="nav-link hover:text-muted transition-colors">Browse Pieces</a>
            <a href="/journal" class="nav-link nav-active hover:text-muted transition-colors">Journal</a>
            <a href="/about" class="nav-link hover:text-muted transition-colors">About</a>
            <a href="/process" class="nav-link hover:text-muted transition-colors">Process</a>
            <a href="/" class="brutal-btn brutal-btn--solid px-5 py-2 text-xs font-space font-bold tracking-widest">Back to Home</a>
        </div>
        <button onclick="document.getElementById('mobile-menu').style.opacity='1'; document.getElementById('mobile-menu').style.pointerEvents='auto'; document.body.style.overflow='hidden';" class="md:hidden text-ivory" aria-label="Menu">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z"/></svg>
        </button>
    </nav>
    <div id="mobile-menu" class="fixed inset-0 z-50 bg-charcoal/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-8 transition-all duration-500 opacity-0 pointer-events-none">
        <button onclick="document.getElementById('mobile-menu').style.opacity='0'; document.getElementById('mobile-menu').style.pointerEvents='none'; document.body.style.overflow='';" class="absolute top-4 right-6 text-ivory" aria-label="Close menu">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <a href="/inventory" class="text-2xl font-space font-bold uppercase tracking-widest hover:text-muted transition-colors">Browse Pieces</a>
        <a href="/journal" class="text-2xl font-space font-bold uppercase tracking-widest text-ivory">Journal</a>
        <a href="/about" class="text-2xl font-space font-bold uppercase tracking-widest hover:text-muted transition-colors">About</a>
        <a href="/process" class="text-2xl font-space font-bold uppercase tracking-widest hover:text-muted transition-colors">Process</a>
        <a href="/" class="brutal-btn brutal-btn--solid px-8 py-3 text-sm font-space font-bold tracking-widest">Back to Home</a>
    </div>`;
}

function footerHtml() {
    return `
    <footer class="relative border-t border-ivory/10 py-14 sm:py-16 px-6">
        <div class="max-w-5xl mx-auto text-center">
            <a href="/" class="inline-block mb-10"><img src="/images/logo.png" alt="Prime Time Miami" class="h-9 w-auto object-contain mx-auto"></a>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-12">
                <div>
                    <h4 class="font-space font-bold text-xs tracking-[0.25em] uppercase mb-4">Location</h4>
                    <p class="no-caps font-inter text-sm text-muted">Miami, Florida</p>
                </div>
                <div>
                    <h4 class="font-space font-bold text-xs tracking-[0.25em] uppercase mb-4">Contact</h4>
                    <p class="no-caps font-inter text-sm"><a href="https://wa.me/13059224975" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-ivory transition-colors">+1 (305) 922-4975</a></p>
                    <p class="no-caps font-inter text-sm" style="margin-top:8px;"><a href="mailto:sales@primetimemiami.com" class="text-muted hover:text-ivory transition-colors">sales@primetimemiami.com</a></p>
                </div>
                <div>
                    <h4 class="font-space font-bold text-xs tracking-[0.25em] uppercase mb-4">Social</h4>
                    <p class="no-caps font-inter text-sm">
                        <a href="https://www.instagram.com/primetime.miami/" target="_blank" rel="noopener noreferrer" class="text-muted hover:text-ivory transition-colors" style="display:inline-flex;align-items:center;gap:7px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.2"/><circle cx="12" cy="12" r="4.6"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>
                            Instagram</a>
                    </p>
                </div>
            </div>
            <p class="text-xs font-space uppercase tracking-widest text-muted mb-4">&copy; 2026 Prime Time Miami</p>
            <p class="no-caps text-[10px] text-muted/30 font-inter max-w-lg mx-auto mb-3 leading-relaxed">Prime Time Miami is an independent sourcing firm and is not an authorized dealer for any watch brand. All brand names, logos, and trademarks referenced on this site belong to their respective owners and are used for identification purposes only.</p>
            <a href="/privacy" class="text-[10px] text-muted/30 font-space uppercase tracking-widest hover:text-muted transition-colors">Privacy &amp; Terms</a>
        </div>
    </footer>
    <a href="https://wa.me/13059224975" target="_blank" rel="noopener noreferrer" id="floating-wa" aria-label="Message Prime Time Miami on WhatsApp"
       class="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[60] w-14 h-14 sm:w-[58px] sm:h-[58px] rounded-full flex items-center justify-center shadow-2xl transition-transform duration-300 hover:scale-110 active:scale-95" style="background:#25D366;">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.88a11.8 11.8 0 0 0 1.64 6l-1.74 6.36 6.51-1.71a11.86 11.86 0 0 0 5.48 1.4h.01c6.55 0 11.89-5.33 11.89-11.88 0-3.18-1.24-6.17-3.43-8.57Zm-8.47 18.3h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.86 1.01 1.03-3.77-.23-.39a9.82 9.82 0 0 1-1.51-5.26c0-5.43 4.43-9.86 9.87-9.86 2.63 0 5.1 1.03 6.96 2.89a9.79 9.79 0 0 1 2.89 6.98c0 5.44-4.43 9.87-9.87 9.87Zm5.41-7.39c-.3-.15-1.75-.86-2.02-.96s-.47-.15-.67.15-.77.96-.94 1.16-.35.22-.64.07a8.08 8.08 0 0 1-2.37-1.46 8.94 8.94 0 0 1-1.65-2.05c-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.48-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37s-1.05 1.03-1.05 2.51 1.08 2.91 1.23 3.11c.15.2 2.12 3.24 5.13 4.54.72.31 1.28.5 1.72.63.72.23 1.38.2 1.9.12.58-.09 1.75-.71 2-1.4.25-.69.25-1.27.17-1.39-.07-.12-.27-.2-.57-.35Z"/></svg>
    </a>`;
}

function shell({ head, main, status }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>${HEAD_COMMON}${head}
<script defer src="/_vercel/insights/script.js"></script>
</head>
<body class="min-h-screen bg-charcoal text-ivory selection:bg-ivory selection:text-charcoal font-inter" style="background:#000">
${navHtml()}
<main class="pa-page"><div class="container">${main}</div></main>
${footerHtml()}
<script src="/scripts/premium-ui.js"></script>
</body>
</html>`;
}

function notFoundHtml() {
    return shell({
        head: `<title>Article not found | Journal | Prime Time Miami</title><meta name="robots" content="noindex, nofollow">`,
        main: `
<a class="pa-crumb" href="/journal">&larr; Journal</a>
<h1 class="pa-title">Article not found</h1>
<p class="pa-sub">That entry either moved or never existed. Head back to the journal.</p>
<div class="row" style="display:flex;gap:14px;flex-wrap:wrap"><a href="/journal" class="brutal-btn brutal-btn--solid px-8 py-3.5 text-xs font-space font-bold tracking-widest text-center">Back to Journal</a></div>`,
    });
}

function renderArticleHtml(a) {
    const title = a.title || "Untitled";
    const subtitle = a.subtitle || "";
    const seoTitle = a.seo_title || `${title} | Journal | Prime Time Miami`;
    const description = a.seo_description || a.excerpt || subtitle || "Notes from Prime Time Miami on Rolex, Patek Philippe, Audemars Piguet and Richard Mille.";
    const heroUrl = a.hero_image_url || OG_FALLBACK;
    const heroAlt = a.hero_alt || title;
    const canonical = `${SITE_URL}/journal/${a.slug}`;
    const pubDate = a.published_at;
    const pubDateText = formatPubDate(pubDate);
    const readingTime = a.reading_time_minutes || null;
    const category = a.category || null;
    const author = a.author_name || "Prime Time Miami";

    const jsonLdArticle = {
        "@context": "https://schema.org", "@type": "Article",
        headline: title, description, image: [heroUrl],
        datePublished: pubDate, dateModified: a.updated_at || pubDate,
        author: { "@type": "Organization", name: author },
        publisher: { "@type": "Organization", name: "Prime Time Miami", logo: { "@type": "ImageObject", url: `${SITE_URL}/images/logo.png` } },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        ...(category ? { articleSection: category } : {}),
    };
    const jsonLdBreadcrumb = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
            { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/journal` },
            { "@type": "ListItem", position: 3, name: title, item: canonical },
        ],
    };

    const head = `
<title>${escHtml(seoTitle)}</title>
<meta name="description" content="${escHtml(description)}">
<meta name="author" content="${escHtml(author)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:url" content="${canonical}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:image" content="${escHtml(heroUrl)}">
<meta property="og:image:alt" content="${escHtml(heroAlt)}">
<meta property="og:site_name" content="Prime Time Miami">
${pubDate ? `<meta property="article:published_time" content="${escHtml(pubDate)}">` : ""}
${category ? `<meta property="article:section" content="${escHtml(category)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(heroUrl)}">
<script type="application/ld+json">${JSON.stringify(jsonLdArticle).replace(/</g, "\\u003c")}</script>
<script type="application/ld+json">${JSON.stringify(jsonLdBreadcrumb).replace(/</g, "\\u003c")}</script>`;

    const main = `
<a class="pa-crumb" href="/journal">&larr; Journal</a>
<div class="pa-meta">
    ${category ? `<span>${escHtml(category)}</span>` : ""}
    ${pubDateText ? `<span>${escHtml(pubDateText)}</span>` : ""}
    ${readingTime ? `<span>${readingTime} min read</span>` : ""}
</div>
<h1 class="pa-title">${escHtml(title)}</h1>
${subtitle ? `<p class="pa-sub">${escHtml(subtitle)}</p>` : ""}
${a.hero_image_url ? `<img class="pa-hero" src="${escHtml(a.hero_image_url)}" alt="${escHtml(heroAlt)}" loading="eager">` : ""}
<div class="pa-heroline"><span>By ${escHtml(author)}</span><span class="didone">Prime Time Miami</span></div>
<div class="pa-body">${a.content_html || ""}</div>
<div class="pa-cta">
    <h3>Looking for a piece?</h3>
    <p>Tell us what you are after and we will get to work.</p>
    <div class="row">
        <a href="/inventory" class="brutal-btn px-8 py-3.5 text-xs font-space font-bold tracking-widest text-center">Browse Pieces</a>
        <a href="https://wa.me/13059224975" target="_blank" rel="noopener noreferrer" class="brutal-btn brutal-btn--solid px-8 py-3.5 text-xs font-space font-bold tracking-widest text-center">Start a Conversation</a>
    </div>
</div>`;

    return shell({ head, main });
}

module.exports = async (req, res) => {
    const slug = req.query.slug ? String(req.query.slug).trim() : null;
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    if (!slug || !/^[a-z0-9-]+$/.test(slug)) return res.status(404).send(notFoundHtml());
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(404).send(notFoundHtml());

    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/journal_articles?slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        });
        if (!r.ok) {
            console.error("[journal-render] Supabase error:", r.status);
            return res.status(500).send(notFoundHtml());
        }
        const rows = await r.json();
        if (!rows || rows.length === 0) return res.status(404).send(notFoundHtml());

        const article = rows[0];
        // Fire-and-forget view increment
        fetch(`${SUPABASE_URL}/rest/v1/journal_articles?id=eq.${article.id}`, {
            method: "PATCH",
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ view_count: (article.view_count || 0) + 1 }),
        }).catch(() => {});

        res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
        return res.status(200).send(renderArticleHtml(article));
    } catch (err) {
        console.error("[journal-render]", err.message);
        return res.status(500).send(notFoundHtml());
    }
};
