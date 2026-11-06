// Canonical city list for JuNubin — every place the app is willing to
// suggest, with an approximate city-centre coordinate.
//
// Two groups, both load-bearing:
//
//   'south-sudan' — the 10 state capitals, the 3 administrative-area
//                   capitals, and the towns large enough that someone
//                   would name them as "where I'm from". This is the
//                   home half of the diaspora question.
//
//   'diaspora'    — resettlement and refugee-hosting cities where South
//                   Sudanese communities actually live. Ordered by
//                   community size within each country, not by the
//                   city's own population: Omaha outranks Chicago here
//                   for the same reason Kakuma outranks Mombasa.
//
// Coordinates are city-centre approximations to 3 decimal places
// (~110 m). They are used for two things and nothing else:
//   1. Seeding demo/test profiles at plausible map positions
//      (see scripts/generate-city-seed.js).
//   2. Centring the Nearby map when a user browses a city that isn't
//      the one their device is in.
// They are NEVER used as a real user's location — a live pin always
// comes from `expo-location` under the consent flow in
// utils/locationConsent.js, bucketed by useNearbyPeople.
//
// The city input stays FREE TEXT everywhere. This list drives
// suggestions and search ranking; it is not a validation allowlist.
// Someone in Wanyjok or Tucson must still be able to type it.

export const CITY_GROUPS = Object.freeze({
  SOUTH_SUDAN: 'south-sudan',
  DIASPORA: 'diaspora',
});

const SS = CITY_GROUPS.SOUTH_SUDAN;
const DX = CITY_GROUPS.DIASPORA;

// `admin` is the sub-national label shown after the city name (US/CA
// state or province code, AU state code). Omitted where the country
// alone is how people say it ("London, UK", "Juba, South Sudan").
// `region` is the South Sudanese state — kept separate from `admin`
// because it is searchable ("Jonglei" should find Bor) but is not part
// of the display label.
export const CITIES = Object.freeze([
  // ── South Sudan: state capitals ────────────────────────────────────
  { id: 'juba',        name: 'Juba',        region: 'Central Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.859,  longitude: 31.571, group: SS },
  { id: 'torit',       name: 'Torit',       region: 'Eastern Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.412,  longitude: 32.570, group: SS },
  { id: 'yambio',      name: 'Yambio',      region: 'Western Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.572,  longitude: 28.395, group: SS },
  { id: 'bor',         name: 'Bor',         region: 'Jonglei',                     country: 'South Sudan', countryCode: 'SS', latitude: 6.209,  longitude: 31.559, group: SS },
  { id: 'bentiu',      name: 'Bentiu',      region: 'Unity',                       country: 'South Sudan', countryCode: 'SS', latitude: 9.259,  longitude: 29.798, group: SS },
  { id: 'malakal',     name: 'Malakal',     region: 'Upper Nile',                  country: 'South Sudan', countryCode: 'SS', latitude: 9.533,  longitude: 31.660, group: SS },
  { id: 'kuajok',      name: 'Kuajok',      region: 'Warrap',                      country: 'South Sudan', countryCode: 'SS', latitude: 8.309,  longitude: 27.985, group: SS },
  { id: 'aweil',       name: 'Aweil',       region: 'Northern Bahr el Ghazal',     country: 'South Sudan', countryCode: 'SS', latitude: 8.767,  longitude: 27.400, group: SS },
  { id: 'wau',         name: 'Wau',         region: 'Western Bahr el Ghazal',      country: 'South Sudan', countryCode: 'SS', latitude: 7.702,  longitude: 27.990, group: SS },
  { id: 'rumbek',      name: 'Rumbek',      region: 'Lakes',                       country: 'South Sudan', countryCode: 'SS', latitude: 6.800,  longitude: 29.678, group: SS },

  // ── South Sudan: administrative areas ─────────────────────────────
  { id: 'abyei',       name: 'Abyei',       region: 'Abyei Administrative Area',   country: 'South Sudan', countryCode: 'SS', latitude: 9.593,  longitude: 28.436, group: SS },
  { id: 'pariang',     name: 'Pariang',     region: 'Ruweng Administrative Area',  country: 'South Sudan', countryCode: 'SS', latitude: 9.831,  longitude: 29.930, group: SS },
  { id: 'pibor',       name: 'Pibor',       region: 'Greater Pibor Admin. Area',   country: 'South Sudan', countryCode: 'SS', latitude: 6.800,  longitude: 33.133, group: SS },

  // ── South Sudan: other major towns ────────────────────────────────
  { id: 'nimule',      name: 'Nimule',      region: 'Eastern Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 3.598,  longitude: 32.056, group: SS },
  { id: 'yei',         name: 'Yei',         region: 'Central Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.090,  longitude: 30.677, group: SS },
  { id: 'kajo-keji',   name: 'Kajo-Keji',   region: 'Central Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 3.858,  longitude: 31.657, group: SS },
  { id: 'terekeka',    name: 'Terekeka',    region: 'Central Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 5.442,  longitude: 31.750, group: SS },
  { id: 'kapoeta',     name: 'Kapoeta',     region: 'Eastern Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.770,  longitude: 33.590, group: SS },
  { id: 'maridi',      name: 'Maridi',      region: 'Western Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 4.917,  longitude: 29.467, group: SS },
  { id: 'mundri',      name: 'Mundri',      region: 'Western Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 5.229,  longitude: 30.474, group: SS },
  { id: 'tambura',     name: 'Tambura',     region: 'Western Equatoria',           country: 'South Sudan', countryCode: 'SS', latitude: 5.600,  longitude: 27.467, group: SS },
  { id: 'nasir',       name: 'Nasir',       region: 'Upper Nile',                  country: 'South Sudan', countryCode: 'SS', latitude: 8.608,  longitude: 33.061, group: SS },
  { id: 'renk',        name: 'Renk',        region: 'Upper Nile',                  country: 'South Sudan', countryCode: 'SS', latitude: 11.750, longitude: 32.783, group: SS },
  { id: 'akobo',       name: 'Akobo',       region: 'Jonglei',                     country: 'South Sudan', countryCode: 'SS', latitude: 7.783,  longitude: 33.000, group: SS },
  { id: 'ayod',        name: 'Ayod',        region: 'Jonglei',                     country: 'South Sudan', countryCode: 'SS', latitude: 8.133,  longitude: 31.400, group: SS },
  { id: 'leer',        name: 'Leer',        region: 'Unity',                       country: 'South Sudan', countryCode: 'SS', latitude: 8.300,  longitude: 30.140, group: SS },
  { id: 'yirol',       name: 'Yirol',       region: 'Lakes',                       country: 'South Sudan', countryCode: 'SS', latitude: 6.550,  longitude: 30.500, group: SS },
  { id: 'tonj',        name: 'Tonj',        region: 'Warrap',                      country: 'South Sudan', countryCode: 'SS', latitude: 7.272,  longitude: 28.680, group: SS },
  { id: 'gogrial',     name: 'Gogrial',     region: 'Warrap',                      country: 'South Sudan', countryCode: 'SS', latitude: 8.533,  longitude: 28.117, group: SS },
  { id: 'raja',        name: 'Raja',        region: 'Western Bahr el Ghazal',      country: 'South Sudan', countryCode: 'SS', latitude: 8.462,  longitude: 25.679, group: SS },

  // ── Diaspora: East Africa & the region ────────────────────────────
  // Kakuma and the Ugandan settlements are listed as cities on purpose.
  // For a large share of users they are the honest answer to "which
  // city are you in", and omitting them would make the app feel like it
  // was built only for the resettled half of the diaspora.
  { id: 'nairobi',     name: 'Nairobi',     country: 'Kenya',          countryCode: 'KE', latitude: -1.286, longitude: 36.817,  group: DX },
  { id: 'kakuma',      name: 'Kakuma',      country: 'Kenya',          countryCode: 'KE', latitude: 3.718,  longitude: 34.868,  group: DX },
  { id: 'eldoret',     name: 'Eldoret',     country: 'Kenya',          countryCode: 'KE', latitude: 0.514,  longitude: 35.270,  group: DX },
  { id: 'kampala',     name: 'Kampala',     country: 'Uganda',         countryCode: 'UG', latitude: 0.348,  longitude: 32.583,  group: DX },
  { id: 'bidi-bidi',   name: 'Bidi Bidi',   country: 'Uganda',         countryCode: 'UG', latitude: 3.470,  longitude: 31.350,  group: DX },
  { id: 'adjumani',    name: 'Adjumani',    country: 'Uganda',         countryCode: 'UG', latitude: 3.377,  longitude: 31.791,  group: DX },
  { id: 'arua',        name: 'Arua',        country: 'Uganda',         countryCode: 'UG', latitude: 3.020,  longitude: 30.911,  group: DX },
  { id: 'khartoum',    name: 'Khartoum',    country: 'Sudan',          countryCode: 'SD', latitude: 15.501, longitude: 32.559,  group: DX },
  { id: 'cairo',       name: 'Cairo',       country: 'Egypt',          countryCode: 'EG', latitude: 30.044, longitude: 31.236,  group: DX },
  { id: 'addis-ababa', name: 'Addis Ababa', country: 'Ethiopia',       countryCode: 'ET', latitude: 9.030,  longitude: 38.741,  group: DX },
  { id: 'gambella',    name: 'Gambella',    country: 'Ethiopia',       countryCode: 'ET', latitude: 8.250,  longitude: 34.583,  group: DX },

  // ── Diaspora: United States ───────────────────────────────────────
  { id: 'omaha',       name: 'Omaha',        admin: 'NE', country: 'United States', countryCode: 'US', latitude: 41.257, longitude: -95.938,  group: DX },
  { id: 'minneapolis', name: 'Minneapolis',  admin: 'MN', country: 'United States', countryCode: 'US', latitude: 44.978, longitude: -93.265,  group: DX },
  { id: 'kansas-city', name: 'Kansas City',  admin: 'MO', country: 'United States', countryCode: 'US', latitude: 39.100, longitude: -94.579,  group: DX },
  { id: 'des-moines',  name: 'Des Moines',   admin: 'IA', country: 'United States', countryCode: 'US', latitude: 41.586, longitude: -93.625,  group: DX },
  { id: 'sioux-falls', name: 'Sioux Falls',  admin: 'SD', country: 'United States', countryCode: 'US', latitude: 43.550, longitude: -96.700,  group: DX },
  { id: 'phoenix',     name: 'Phoenix',      admin: 'AZ', country: 'United States', countryCode: 'US', latitude: 33.448, longitude: -112.074, group: DX },
  { id: 'dallas',      name: 'Dallas',       admin: 'TX', country: 'United States', countryCode: 'US', latitude: 32.777, longitude: -96.797,  group: DX },
  { id: 'houston',     name: 'Houston',      admin: 'TX', country: 'United States', countryCode: 'US', latitude: 29.760, longitude: -95.370,  group: DX },
  { id: 'washington',  name: 'Washington',   admin: 'DC', country: 'United States', countryCode: 'US', latitude: 38.907, longitude: -77.037,  group: DX },
  { id: 'nashville',   name: 'Nashville',    admin: 'TN', country: 'United States', countryCode: 'US', latitude: 36.163, longitude: -86.781,  group: DX },
  { id: 'louisville',  name: 'Louisville',   admin: 'KY', country: 'United States', countryCode: 'US', latitude: 38.253, longitude: -85.758,  group: DX },
  { id: 'columbus',    name: 'Columbus',     admin: 'OH', country: 'United States', countryCode: 'US', latitude: 39.961, longitude: -82.999,  group: DX },
  { id: 'chicago',     name: 'Chicago',      admin: 'IL', country: 'United States', countryCode: 'US', latitude: 41.878, longitude: -87.630,  group: DX },
  { id: 'syracuse',    name: 'Syracuse',     admin: 'NY', country: 'United States', countryCode: 'US', latitude: 43.048, longitude: -76.147,  group: DX },
  { id: 'new-york',    name: 'New York',     admin: 'NY', country: 'United States', countryCode: 'US', latitude: 40.713, longitude: -74.006,  group: DX },
  { id: 'boston',      name: 'Boston',       admin: 'MA', country: 'United States', countryCode: 'US', latitude: 42.360, longitude: -71.059,  group: DX },
  { id: 'portland-me', name: 'Portland',     admin: 'ME', country: 'United States', countryCode: 'US', latitude: 43.659, longitude: -70.256,  group: DX },
  { id: 'atlanta',     name: 'Atlanta',      admin: 'GA', country: 'United States', countryCode: 'US', latitude: 33.749, longitude: -84.388,  group: DX },
  { id: 'charlotte',   name: 'Charlotte',    admin: 'NC', country: 'United States', countryCode: 'US', latitude: 35.227, longitude: -80.843,  group: DX },
  { id: 'denver',      name: 'Denver',       admin: 'CO', country: 'United States', countryCode: 'US', latitude: 39.739, longitude: -104.990, group: DX },
  { id: 'salt-lake',   name: 'Salt Lake City', admin: 'UT', country: 'United States', countryCode: 'US', latitude: 40.761, longitude: -111.891, group: DX },
  { id: 'seattle',     name: 'Seattle',      admin: 'WA', country: 'United States', countryCode: 'US', latitude: 47.606, longitude: -122.332, group: DX },
  { id: 'san-diego',   name: 'San Diego',    admin: 'CA', country: 'United States', countryCode: 'US', latitude: 32.716, longitude: -117.161, group: DX },

  // ── Diaspora: Canada ──────────────────────────────────────────────
  { id: 'calgary',     name: 'Calgary',     admin: 'AB', country: 'Canada', countryCode: 'CA', latitude: 51.045, longitude: -114.057, group: DX },
  { id: 'edmonton',    name: 'Edmonton',    admin: 'AB', country: 'Canada', countryCode: 'CA', latitude: 53.546, longitude: -113.494, group: DX },
  { id: 'toronto',     name: 'Toronto',     admin: 'ON', country: 'Canada', countryCode: 'CA', latitude: 43.653, longitude: -79.383,  group: DX },
  { id: 'ottawa',      name: 'Ottawa',      admin: 'ON', country: 'Canada', countryCode: 'CA', latitude: 45.421, longitude: -75.700,  group: DX },
  { id: 'winnipeg',    name: 'Winnipeg',    admin: 'MB', country: 'Canada', countryCode: 'CA', latitude: 49.895, longitude: -97.138,  group: DX },
  { id: 'vancouver',   name: 'Vancouver',   admin: 'BC', country: 'Canada', countryCode: 'CA', latitude: 49.283, longitude: -123.121, group: DX },

  // ── Diaspora: United Kingdom & Ireland ────────────────────────────
  { id: 'london',      name: 'London',      country: 'UK',      countryCode: 'GB', latitude: 51.507, longitude: -0.128, group: DX },
  { id: 'manchester',  name: 'Manchester',  country: 'UK',      countryCode: 'GB', latitude: 53.481, longitude: -2.242, group: DX },
  { id: 'birmingham',  name: 'Birmingham',  country: 'UK',      countryCode: 'GB', latitude: 52.487, longitude: -1.890, group: DX },
  { id: 'leeds',       name: 'Leeds',       country: 'UK',      countryCode: 'GB', latitude: 53.801, longitude: -1.549, group: DX },
  { id: 'dublin',      name: 'Dublin',      country: 'Ireland', countryCode: 'IE', latitude: 53.350, longitude: -6.260, group: DX },

  // ── Diaspora: Australia & New Zealand ─────────────────────────────
  { id: 'melbourne',   name: 'Melbourne',   admin: 'VIC', country: 'Australia',   countryCode: 'AU', latitude: -37.814, longitude: 144.963, group: DX },
  { id: 'sydney',      name: 'Sydney',      admin: 'NSW', country: 'Australia',   countryCode: 'AU', latitude: -33.869, longitude: 151.209, group: DX },
  { id: 'brisbane',    name: 'Brisbane',    admin: 'QLD', country: 'Australia',   countryCode: 'AU', latitude: -27.470, longitude: 153.021, group: DX },
  { id: 'adelaide',    name: 'Adelaide',    admin: 'SA',  country: 'Australia',   countryCode: 'AU', latitude: -34.929, longitude: 138.601, group: DX },
  { id: 'perth',       name: 'Perth',       admin: 'WA',  country: 'Australia',   countryCode: 'AU', latitude: -31.953, longitude: 115.857, group: DX },
  { id: 'auckland',    name: 'Auckland',    country: 'New Zealand', countryCode: 'NZ', latitude: -36.848, longitude: 174.763, group: DX },

  // ── Diaspora: continental Europe ──────────────────────────────────
  { id: 'oslo',        name: 'Oslo',        country: 'Norway',      countryCode: 'NO', latitude: 59.913, longitude: 10.752, group: DX },
  { id: 'stockholm',   name: 'Stockholm',   country: 'Sweden',      countryCode: 'SE', latitude: 59.329, longitude: 18.069, group: DX },
  { id: 'amsterdam',   name: 'Amsterdam',   country: 'Netherlands', countryCode: 'NL', latitude: 52.370, longitude: 4.895,  group: DX },
]);

// Display label: "Minneapolis, MN", "London, UK", "Juba, South Sudan".
// This is the exact string written to User.city when a suggestion is
// tapped, so it must stay stable — existing rows are matched against it.
export const cityLabel = (city) =>
  (city?.admin ? `${city.name}, ${city.admin}` : `${city?.name}, ${city?.country}`);

export const SOUTH_SUDAN_CITIES = CITIES.filter((c) => c.group === SS);
export const DIASPORA_CITIES = CITIES.filter((c) => c.group === DX);

// Chips shown on the ProfileSetup city step before the user types.
// Deliberately mixes home and diaspora so neither half of the audience
// opens the step and sees only other people's cities.
export const SUGGESTED_CITY_IDS = Object.freeze([
  'juba', 'nairobi', 'kampala', 'khartoum', 'cairo',
  'omaha', 'minneapolis', 'melbourne', 'london', 'toronto',
]);

export const SUGGESTED_CITIES = SUGGESTED_CITY_IDS
  .map((id) => CITIES.find((c) => c.id === id))
  .filter(Boolean);

const normalize = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/**
 * Resolve a stored `User.city` string back to a CITIES row.
 * Accepts either the full label ("Minneapolis, MN") or the bare city
 * name ("Minneapolis") — legacy rows predate the label format, and
 * free-text entries never had one.
 */
export function findCity(value) {
  const q = normalize(value);
  if (!q) return null;
  return (
    CITIES.find((c) => normalize(cityLabel(c)) === q) ||
    CITIES.find((c) => normalize(c.name) === q) ||
    null
  );
}

/**
 * Rank cities against a free-text query. Prefix matches on the city
 * name come first (typing "jub" should surface Juba, not Kajo-Keji),
 * then substring matches on the name, then matches on the state /
 * country — so "Jonglei" finds Bor and "Kenya" finds Kakuma.
 *
 * Returns [] for an empty query; callers show SUGGESTED_CITIES then.
 */
export function searchCities(query, limit = 8) {
  const q = normalize(query);
  if (!q) return [];
  const scored = [];
  for (const city of CITIES) {
    const name = normalize(city.name);
    let score;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (normalize(city.region).includes(q)) score = 3;
    else if (normalize(city.country).includes(q) || normalize(city.admin) === q) score = 4;
    else continue;
    scored.push({ city, score });
  }
  // Stable within a score band: CITIES order already encodes our
  // intended priority (home first, then diaspora by community size).
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.city);
}
