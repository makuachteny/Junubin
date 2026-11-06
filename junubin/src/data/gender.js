// Single source of truth for Gender values across the app.
//
// The database stores a Postgres enum (00001_schema.sql):
//   CREATE TYPE "Gender" AS ENUM ('man', 'woman', 'non_binary', 'other');
// while the UI shows capitalized labels. Sending a UI label straight to
// the DB ("Man") fails with `invalid value for enum: "Gender"`, so both
// ProfileSetup and EditProfile MUST map through here. Keeping the maps in
// one file prevents the two screens drifting apart again.

// Valid DB enum values — must match the migration exactly.
export const GENDER_DB_VALUES = ['man', 'woman', 'non_binary', 'other'];

// UI labels shown in the gender chip picker. 'other' has no picker entry
// (the survey never offered it), so it's intentionally absent here.
export const GENDER_OPTIONS = ['Man', 'Woman', 'Nonbinary'];

export const GENDER_UI_TO_DB = { Man: 'man', Woman: 'woman', Nonbinary: 'non_binary' };
export const GENDER_DB_TO_UI = { man: 'Man', woman: 'Woman', non_binary: 'Nonbinary', other: '' };

// UI label → DB enum value. Returns null for an empty/unknown label so
// callers can omit the field rather than write an invalid value.
export function toDbGender(uiLabel) {
  return GENDER_UI_TO_DB[uiLabel] || null;
}

// DB enum value → UI label. Returns '' for 'other'/unknown so the picker
// simply shows nothing selected.
export function toUiGender(dbValue) {
  return GENDER_DB_TO_UI[dbValue] || '';
}
