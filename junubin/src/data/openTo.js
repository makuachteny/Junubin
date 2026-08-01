// "What are you open to?" — the multi-select vocabulary that replaced the
// purpose cards in the setup flow.
//
// Persisted to Profile.openTo as a JSONB array of `key` strings (NOT
// labels — labels are display copy and may be reworded; keys are the
// contract). Rendered by:
//   - ProfileSetupScreen  → the `openTo` step (testID `open-to-<key>`)
//   - EditProfileScreen   → the "Open to" badge row
//
// `icon` values are Ionicons names — both screens already render
// Ionicons, so no new dependency.
//
// Adding an option: append it. Never reuse or repurpose an existing
// `key`, or previously-saved profiles will silently change meaning.
export const OPEN_TO_OPTIONS = [
  { key: 'friendship',   label: 'Friendship',           icon: 'happy-outline' },
  { key: 'community',    label: 'Community',            icon: 'people-outline' },
  { key: 'cultural',     label: 'Cultural connection',  icon: 'globe-outline' },
  { key: 'student',      label: 'Student network',      icon: 'school-outline' },
  { key: 'professional', label: 'Professional network', icon: 'briefcase-outline' },
  { key: 'mentorship',   label: 'Mentorship',           icon: 'compass-outline' },
  { key: 'business',     label: 'Business',             icon: 'storefront-outline' },
  // Labelled "Meeting up" rather than "Events & meetups": JuNubin has
  // no events feature, and the old label implied one. The key stays
  // `events` because keys are the persisted contract.
  { key: 'events',       label: 'Meeting up',           icon: 'calendar-outline' },
  { key: 'newcomer',     label: 'Newcomer help',        icon: 'hand-left-outline' },
  { key: 'housing',      label: 'Housing help',         icon: 'home-outline' },
  { key: 'sports',       label: 'Sports',               icon: 'basketball-outline' },
  { key: 'faith',        label: 'Faith community',      icon: 'book-outline' },
];

export const OPEN_TO_KEYS = OPEN_TO_OPTIONS.map((o) => o.key);

export const OPEN_TO_BY_KEY = OPEN_TO_OPTIONS.reduce((acc, o) => {
  acc[o.key] = o;
  return acc;
}, {});

/**
 * Normalize whatever the backend hands us into a clean array of known
 * keys. An un-migrated backend returns `null` (column doesn't exist yet
 * / never written), and legacy rows may hold labels instead of keys —
 * both must render rather than crash.
 */
export function normalizeOpenTo(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    if (OPEN_TO_BY_KEY[entry]) {
      if (!out.includes(entry)) out.push(entry);
      continue;
    }
    const byLabel = OPEN_TO_OPTIONS.find(
      (o) => o.label.toLowerCase() === entry.toLowerCase()
    );
    if (byLabel && !out.includes(byLabel.key)) out.push(byLabel.key);
  }
  return out;
}

/** Display helper — 'Friendship · Community · Sports' */
export function openToLabels(keys) {
  return normalizeOpenTo(keys).map((k) => OPEN_TO_BY_KEY[k].label);
}
