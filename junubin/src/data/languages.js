// Languages spoken — seeded for South Sudanese users and the wider
// diaspora. Persisted to Profile.languages as a JSONB array of the
// exact strings below, so a value saved during onboarding still matches
// a chip in EditProfile (same contract as INTEREST_OPTIONS in
// profileOptions.js — if you reword an entry, existing rows silently
// render as unselected).
//
// Ordering is deliberate: the lingua francas people actually type first
// (Juba Arabic, English, Sudanese Arabic), then South Sudanese
// languages roughly by number of speakers, then regional/diaspora
// languages, then the 'Other' escape hatch.
export const LANGUAGE_OPTIONS = [
  // Lingua francas
  'Juba Arabic',
  'English',
  'Sudanese Arabic',
  // South Sudanese languages
  'Dinka',
  'Nuer',
  'Bari',
  'Shilluk',
  'Zande',
  'Kakwa',
  'Madi',
  'Toposa',
  'Otuho/Lotuko',
  'Murle',
  'Anuak',
  'Kuku',
  'Moru',
  'Ndogo',
  // Regional / diaspora
  'Swahili',
  'Amharic',
  'French',
  'Other',
];

/**
 * Everything must still render if Profile.languages comes back null
 * from an un-migrated backend — normalize to [] and drop anything that
 * isn't a string we recognise.
 */
export function normalizeLanguages(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const match = LANGUAGE_OPTIONS.find(
      (l) => l.toLowerCase() === entry.trim().toLowerCase()
    );
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}
