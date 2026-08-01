const { Client } = require('@notionhq/client');

let notion;
let DATABASE_ID;

function getNotion() {
    if (!notion) {
        if (!process.env.NOTION_API_KEY) {
            throw new Error('NOTION_API_KEY environment variable is not set');
        }
        if (!process.env.NOTION_DATABASE_ID) {
            throw new Error('NOTION_DATABASE_ID environment variable is not set');
        }
        notion = new Client({ auth: process.env.NOTION_API_KEY });
        DATABASE_ID = process.env.NOTION_DATABASE_ID;
    }
    return { notion, DATABASE_ID };
}

// Extract value from a Notion property
function get(prop) {
    if (!prop) return '';
    switch (prop.type) {
        case 'title':
            return prop.title?.map(t => t.plain_text).join('') || '';
        case 'rich_text':
            return prop.rich_text?.map(t => t.plain_text).join('') || '';
        case 'select':
            return prop.select?.name || '';
        case 'number':
            return prop.number ?? '';
        case 'checkbox':
            return prop.checkbox;
        default:
            return '';
    }
}

// Get all image URLs from Files property
function getImages(prop) {
    if (!prop || !prop.files) return [];
    return prop.files.map(f => f.file?.url || f.external?.url || '').filter(Boolean);
}

module.exports = async (req, res) => {
    const allowedOrigins = ['https://primetimemiami.com', 'https://www.primetimemiami.com'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.VERCEL_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { notion, DATABASE_ID } = getNotion();

        // Paginate through all results (Notion returns max 100 per request)
        let allResults = [];
        let cursor = undefined;
        do {
            const response = await notion.databases.query({
                database_id: DATABASE_ID,
                start_cursor: cursor,
                sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
            });
            allResults = allResults.concat(response.results);
            cursor = response.has_more ? response.next_cursor : undefined;
        } while (cursor);

        const pieces = allResults.map(page => {
            const p = page.properties;

            const piece = get(p['Piece']);
            const brand = get(p['Brand']);
            const model = get(p['Model']);
            const nickname = get(p['Nickname']);
            const ref = get(p['Reference Number']);
            const caseMaterial = get(p['Case Material']);
            const caseSizeNum = get(p['Case Size (mm)']);
            const caseSize = caseSizeNum ? `${caseSizeNum}mm` : '';
            const dialColor = get(p['Dial Color']);
            const bracelet = get(p['Bracelet/Strap']);
            const condition = get(p['Condition']);
            const set = get(p['Set']);
            const year = get(p['Year']);
            const images = getImages(p['Image']);

            // Build display name
            const name = piece || `${brand} ${model}`.trim();

            // Short description for card view
            const descParts = [];
            if (caseMaterial) descParts.push(caseMaterial);
            if (dialColor) descParts.push(dialColor + ' dial');
            if (caseSize) descParts.push(caseSize);
            if (bracelet) descParts.push(bracelet);
            const details = descParts.join(' · ');

            return {
                id: page.id,
                brand,
                model,
                name,
                nickname,
                ref,
                details,
                image: images[0] || '',
                images,
                year: year ? String(Math.round(year)) : '',
                condition,
                caseMaterial,
                dialColor,
                bracelet,
                caseSize,
                set
            };
        });

        // Single piece by ID
        const params = req.query || {};
        if (params.id) {
            const piece = pieces.find(w => w.id === params.id);
            if (!piece) {
                return res.status(404).json({ error: 'Piece not found' });
            }
            return res.status(200).json(piece);
        }

        return res.status(200).json(pieces);

    } catch (error) {
        console.error('Notion API error:', error);
        return res.status(500).json({ error: 'Failed to fetch pieces', details: error.message });
    }
};
