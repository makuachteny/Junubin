#!/usr/bin/env node
// Generate supabase/seeds/cities.sql from src/data/cities.js.
//
//   node scripts/generate-city-seed.js
//
// Why generated rather than hand-written: the seed profiles have to sit
// at the same coordinates the app's city list uses, or a tester picks
// "Bor" in the picker and the map centres somewhere the seeded people
// aren't. One source of truth (cities.js), one derived artifact
// (seeds/cities.sql). Re-run this after editing the city list and commit
// both files together.
//
// The generated SQL is idempotent — every INSERT carries a bare
// ON CONFLICT DO NOTHING (untargeted, so it covers the id, email and
// userId unique indexes alike) and every id is derived from the city
// id, so re-running `supabase db reset` — or applying the file twice
// against the same database — is safe.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CITIES_SRC = path.join(ROOT, 'src/data/cities.js');
const OUT_PATH = path.join(ROOT, 'supabase/seeds/cities.sql');

// cities.js is ESM and this package is CJS. Rather than pull a
// transpiler in for one script, strip the `export` keywords and
// evaluate — cities.js is a pure data module with no imports, which is
// exactly the condition that makes this total. The guard below fails
// loudly the day that stops being true, instead of silently producing
// a seed file with no cities in it.
function loadCities() {
  const src = fs.readFileSync(CITIES_SRC, 'utf8');
  if (/^\s*import\s/m.test(src)) {
    throw new Error(
      'src/data/cities.js now has imports; this loader can no longer evaluate it standalone.',
    );
  }
  const cjs = src.replace(/^export\s+/gm, '');
  return new Function(`${cjs}\nreturn { CITIES, cityLabel };`)();
}

// ── Deterministic pseudo-randomness ─────────────────────────────────
// Seeded per city id so re-running the generator produces a byte-identical
// file. Math.random() here would churn the diff on every run and make
// the artifact useless for review.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let s = hash(seed) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

// ── Profile content pools ───────────────────────────────────────────
// South Sudanese names, split by gender so displayName and gender agree.
const WOMEN = ['Adau', 'Abuk', 'Nyibol', 'Achol', 'Nyandeng', 'Aluel', 'Ayen', 'Nyakuor', 'Athieng', 'Akuol', 'Nyalong', 'Awut', 'Aduk', 'Nyakor', 'Amer', 'Ajok', 'Anyieth', 'Nyanut', 'Arek', 'Yar'];
const MEN = ['Deng', 'Garang', 'Majok', 'Chol', 'Bol', 'Kuol', 'Lado', 'Ater', 'Mabior', 'Riek', 'Wani', 'Malith', 'Thon', 'Gatluak', 'Akol', 'Manut', 'Peter', 'Emmanuel', 'Santino', 'Deng'];

const TRIBES = ['Dinka', 'Nuer', 'Bari', 'Shilluk', 'Azande', 'Acholi', 'Lotuko', 'Madi', 'Kakwa', 'Toposa', 'Murle', 'Anuak'];

const JOBS = ['Nurse', 'Software engineer', 'Teacher', 'Student', 'Accountant', 'Driver', 'Shop owner', 'Community organiser', 'Photographer', 'Social worker', 'Mechanic', 'Pharmacist', 'Chef', 'Journalist', 'Tailor', 'Electrician'];

const INTEREST_POOL = ['Faith', 'Music', 'Cooking', 'Travel', 'Reading', 'Football', 'Basketball', 'Dancing', 'Photography', 'Fashion', 'Volunteering', 'Tech', 'Art', 'Running', 'Culture', 'Languages'];

// Must be real keys from src/data/openTo.js — the directory filters
// on them verbatim, so an invented key produces a profile that no
// filter can ever surface.
const OPEN_TO = ['friendship', 'community', 'cultural', 'student', 'professional', 'mentorship', 'business', 'events', 'newcomer', 'housing', 'sports', 'faith'];

// Location visibility mix per city. Most seeded people appear on the
// map ('coarse'); a minority are city-only or hidden, so the privacy
// controls have something real to demonstrate and the map never looks
// like 100% opt-in is normal.
const VISIBILITY_CYCLE = ['coarse', 'coarse', 'coarse', 'city', 'coarse', 'coarse', 'mutuals', 'coarse', 'city', 'off'];

// Public Supabase Storage URLs for the portraits uploaded by
// scripts/upload-seed-photos.js. The previous value pointed at a
// `res.cloudinary.com/placeholder/...` host that returns nothing, so
// every seeded profile rendered a broken image. Override SUPABASE_URL
// when generating against a different project.
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://uvtyiytbgkasemabtznc.supabase.co').replace(/\/$/, '');
const PHOTO_BASE = `${SUPABASE_URL}/storage/v1/object/public/photos/seed`;

const PEOPLE_PER_CITY = 6;

const sql = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// Scatter a person 0.5–6 km from the city centre on a stable bearing so
// pins form a plausible cluster instead of stacking on one point.
function offset(lat, lng, bearingDeg, km) {
  const R = 6371;
  const b = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const d = km / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(
    Math.sin(b) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  );
  // 3 decimals ≈ 110 m — the same bucketing useNearbyPeople applies to
  // real users, so seeded and live pins have identical precision.
  return [
    Math.round(((lat2 * 180) / Math.PI) * 1000) / 1000,
    Math.round(((lng2 * 180) / Math.PI) * 1000) / 1000,
  ];
}

function dobFor(age, rand) {
  // Fixed reference date — a generator that used "today" would rewrite
  // every row's dateOfBirth on each run and make the diff meaningless.
  const year = 2026 - age;
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function pick(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN(arr, n, rand) {
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

function buildPerson(city, index, cityLabel) {
  const rand = rng(`${city.id}:${index}`);
  const isWoman = index % 2 === 0;
  const name = pick(isWoman ? WOMEN : MEN, rand);
  const gender = isWoman ? 'woman' : 'man';
  const id = `seed-${city.id}-${index + 1}`;
  const age = 19 + Math.floor(rand() * 22);
  const bearing = (index * 360) / PEOPLE_PER_CITY + rand() * 40;
  const km = 0.5 + rand() * 5.5;
  const [lat, lng] = offset(city.latitude, city.longitude, bearing, km);
  const visibility = VISIBILITY_CYCLE[(hash(city.id) + index) % VISIBILITY_CYCLE.length];
  const photoIndex = 1 + ((hash(id) % 12));
  // One draw, used by both the job column and the bio. Drawing twice
  // produced rows whose bio said "Teacher in Juba" over a job of
  // "Pharmacist" — nonsense that a reviewer reads as a data bug.
  const job = pick(JOBS, rand);

  return {
    id,
    email: `${id}@seed.local`,
    displayName: name,
    dateOfBirth: dobFor(age, rand),
    gender,
    countryCode: city.countryCode,
    city: cityLabel,
    latitude: visibility === 'off' ? null : lat,
    longitude: visibility === 'off' ? null : lng,
    isVerified: rand() > 0.45,
    ethnicity: pick(TRIBES, rand),
    job,
    bio: `${job} in ${city.name}. ${
      city.group === 'south-sudan'
        ? 'Here for the people building things at home.'
        : 'Looking for other Junubin around here.'
    }`,
    interests: pickN(INTEREST_POOL, 4, rand),
    openTo: pickN(OPEN_TO, 2 + Math.floor(rand() * 2), rand),
    locationVisibility: visibility,
    photo: `${PHOTO_BASE}/p${photoIndex}.jpg`,
  };
}

function main() {
  const { CITIES, cityLabel } = loadCities();

  const lines = [];
  lines.push('-- ============================================================================');
  lines.push('-- GENERATED FILE — do not edit by hand.');
  lines.push('--   Source:    src/data/cities.js');
  lines.push('--   Generator: scripts/generate-city-seed.js');
  lines.push('--   Regenerate: node scripts/generate-city-seed.js');
  lines.push('--');
  lines.push(`-- ${PEOPLE_PER_CITY} demo profiles in each of the ${CITIES.length} cities the app knows`);
  lines.push('-- about, positioned 0.5-6 km from the city centre so the Nearby map and');
  lines.push('-- the directory both have something to show in every location.');
  lines.push('--');
  lines.push('-- These rows carry no auth.users identity: they are browsable but not');
  lines.push('-- loggable-into. Every id is prefixed `seed-` so they can be removed with');
  lines.push('--   DELETE FROM "User" WHERE id LIKE \'seed-%\';');
  lines.push('-- ============================================================================');
  lines.push('');

  let count = 0;
  for (const city of CITIES) {
    const label = cityLabel(city);
    lines.push(`-- ── ${label} ${'─'.repeat(Math.max(0, 60 - label.length))}`);
    for (let i = 0; i < PEOPLE_PER_CITY; i++) {
      const p = buildPerson(city, i, label);
      count++;
      lines.push(
        `INSERT INTO "User" (id, email, "displayName", "dateOfBirth", gender, "countryCode", city, latitude, longitude, "isVerified", "isActive", "moderationStatus", "lastActiveAt", "updatedAt") VALUES (` +
        `${sql(p.id)}, ${sql(p.email)}, ${sql(p.displayName)}, ${sql(p.dateOfBirth)}::date, ${sql(p.gender)}, ${sql(p.countryCode)}, ${sql(p.city)}, ` +
        `${p.latitude === null ? 'NULL' : p.latitude}, ${p.longitude === null ? 'NULL' : p.longitude}, ${p.isVerified}, true, 'active', NOW(), NOW()) ` +
        `ON CONFLICT DO NOTHING;`,
      );
      lines.push(
        `INSERT INTO "Profile" (id, "userId", bio, ethnicity, job, interests, "openTo", "locationVisibility", "accountPurpose", "profileComplete", "updatedAt") VALUES (` +
        `${sql(`${p.id}-profile`)}, ${sql(p.id)}, ${sql(p.bio)}, ${sql(p.ethnicity)}, ${sql(p.job)}, ` +
        `${sql(JSON.stringify(p.interests))}::jsonb, ${sql(JSON.stringify(p.openTo))}::jsonb, ${sql(p.locationVisibility)}, 'socialize', true, NOW()) ` +
        `ON CONFLICT DO NOTHING;`,
      );
      lines.push(
        `INSERT INTO "Photo" (id, "userId", url, "sortOrder", "isPrimary") VALUES (` +
        `${sql(`${p.id}-p1`)}, ${sql(p.id)}, ${sql(p.photo)}, 0, true) ON CONFLICT DO NOTHING;`,
      );
    }
    lines.push('');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join('\n'));
  process.stdout.write(`Wrote ${count} profiles across ${CITIES.length} cities → ${path.relative(ROOT, OUT_PATH)}\n`);
}

main();
