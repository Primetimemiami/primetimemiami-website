// One-time Supabase seed: data/pieces.json + images/pieces/dbh -> pieces table + storage.
// Usage:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seed-supabase.mjs
// Idempotent: re-running upserts rows and skips images that already uploaded.

import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

const URL_ = process.env.SUPABASE_URL?.replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };

const raw = JSON.parse(readFileSync('data/pieces.json', 'utf8'));
const pieces = Array.isArray(raw) ? raw : raw.pieces;
console.log(`${pieces.length} pieces to seed`);

async function uploadImage(localPath, objectName) {
  const res = await fetch(`${URL_}/storage/v1/object/pieces/${objectName}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
    body: readFileSync(localPath),
  });
  if (!res.ok) throw new Error(`upload ${objectName}: ${res.status} ${await res.text()}`);
  return `${URL_}/storage/v1/object/public/pieces/${objectName}`;
}

let uploaded = 0, missing = 0;
const rows = [];
for (const p of pieces) {
  let imageUrl = p.image || '';
  if (p.image && existsSync(p.image)) {
    const objectName = basename(p.image);
    imageUrl = await uploadImage(p.image, objectName);
    uploaded++;
    if (uploaded % 50 === 0) console.log(`  ${uploaded} images uploaded...`);
  } else if (p.image) {
    missing++;
    console.warn(`  missing local image, keeping path as-is: ${p.image}`);
  }
  rows.push({
    id: p.id,
    brand: p.brand ?? '',
    model: p.model ?? '',
    ref: p.ref ?? '',
    year: String(p.year ?? ''),
    case_material: p.caseMaterial ?? '',
    dial_color: p.dialColor ?? '',
    condition: p.condition ?? '',
    description: p.description ?? '',
    image: imageUrl,
    featured: !!p.featured,
    sold: !!p.sold,
  });
}
console.log(`${uploaded} images uploaded, ${missing} missing`);

for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200);
  const res = await fetch(`${URL_}/rest/v1/pieces?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(chunk),
  });
  if (!res.ok) throw new Error(`insert chunk ${i}: ${res.status} ${await res.text()}`);
  console.log(`  rows ${i + 1}-${i + chunk.length} inserted`);
}

const count = await fetch(`${URL_}/rest/v1/pieces?select=id`, {
  headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
});
console.log('DONE. pieces in database:', count.headers.get('content-range')?.split('/')[1]);
