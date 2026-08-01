#!/usr/bin/env node
// Upload the bundled demo portraits to the Supabase `photos` bucket so
// the generated seed profiles have images that actually load.
//
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/upload-seed-photos.js
//
// Optional: SUPABASE_URL=https://<ref>.supabase.co (defaults to the
// project id already committed in eas.json).
//
// Why this exists: supabase/seed.sql and supabase/seeds/cities.sql used
// to point at `res.cloudinary.com/placeholder/...`, a host that returns
// nothing. 504 seeded profiles with broken avatars read as a broken app,
// not as seed data. These are the same portraits the in-bundle demo
// roster uses (src/assets/profiles), so the seeded database and the
// demo-mode client show the same faces.
//
// Idempotent: uploads use upsert, so re-running overwrites rather than
// erroring or duplicating.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src/assets/profiles');
const BUCKET = 'photos';
const PREFIX = 'seed';

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://uvtyiytbgkasemabtznc.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Find it in: Supabase dashboard → Project Settings → API → service_role.');
  console.error('It bypasses RLS — keep it out of the client and out of git.');
  process.exit(1);
}

// Only the primaries. generate-city-seed.js assigns each seeded person
// one photo from p1..p12, so uploading the f/m extras would be dead
// bytes in the bucket.
const FILES = Array.from({ length: 12 }, (_, i) => `p${i + 1}.jpg`);

async function upload(file) {
  const localPath = path.join(SRC_DIR, file);
  if (!fs.existsSync(localPath)) return { file, ok: false, reason: 'missing locally' };

  const body = fs.readFileSync(localPath);
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${PREFIX}/${file}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/jpeg',
      // Overwrite on re-run instead of 409-ing on the second invocation.
      'x-upsert': 'true',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { file, ok: false, reason: `${res.status} ${text.slice(0, 120)}` };
  }
  return { file, ok: true };
}

async function main() {
  const results = [];
  for (const file of FILES) {
    const r = await upload(file);
    results.push(r);
    process.stdout.write(r.ok ? `  ✓ ${PREFIX}/${r.file}\n` : `  ✗ ${r.file} — ${r.reason}\n`);
  }

  const failed = results.filter((r) => !r.ok);
  process.stdout.write(
    `\n${results.length - failed.length}/${results.length} uploaded to ` +
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${PREFIX}/\n`,
  );
  if (failed.length) {
    process.stdout.write('\nSome uploads failed. Check that the `photos` bucket exists and is public\n');
    process.stdout.write('(supabase/migrations/00001_schema.sql creates it).\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
