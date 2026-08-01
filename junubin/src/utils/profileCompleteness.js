// JuNubin — Profile Completeness Calculator
//
// Drives the "Complete Your Profile" card and the deep-link into the EditProfile
// step that's missing. Each FIELD has a `weight` (sum to 100 across required
// items + a soft tail), a `label` for prompts, and an optional `step` key that
// EditProfile can use to scroll/jump to the right input.
const FIELDS = [
  { key: 'displayName', weight: 12, label: 'Display name', step: 'name' },
  { key: 'bio',          weight: 12, label: 'Bio',           step: 'bio' },
  { key: 'photos',       weight: 18, label: 'Photos (at least 3)', step: 'photos', check: (v) => Array.isArray(v) ? v.length >= 3 : !!v },
  { key: 'job',          weight: 8,  label: 'Job title',     step: 'job' },
  { key: 'school',       weight: 5,  label: 'School',        step: 'school' },
  // Height and dating intentions were completeness fields in the
  // dating era. Neither exists post-pivot — "open to" covers intent —
  // so their weight moved to the fields people actually search on.
  { key: 'ethnicity',    weight: 9,  label: 'Tribe / heritage', step: 'ethnicity' },
  { key: 'interests',    weight: 12, label: 'Interests',     step: 'interests', check: (v) => Array.isArray(v) && v.length >= 3 },
  { key: 'openTo',       weight: 6,  label: 'Open to',       step: 'openTo', check: (v) => Array.isArray(v) && v.length >= 1 },
  { key: 'currentlyInto', weight: 5, label: 'Currently Into', step: 'currentlyInto', check: (v) => Array.isArray(v) && v.length >= 1 },
  { key: 'city',         weight: 8,  label: 'Location',      step: 'city' },
  { key: 'verified',     weight: 5,  label: 'Photo verification', step: 'verify', check: (v) => v === true },
];

// Tier thresholds — drive the ring color and copy.
const TIER = {
  low:    { max: 39, label: 'Just getting started', color: 'rose' },
  medium: { max: 74, label: 'Looking good',         color: 'gold' },
  high:   { max: 100, label: 'Profile shines',      color: 'green' },
};

export function getCompletenessTier(score) {
  if (score <= TIER.low.max) return TIER.low;
  if (score <= TIER.medium.max) return TIER.medium;
  return TIER.high;
}

export function calculateCompleteness(user) {
  if (!user) {
    return {
      score: 0,
      filledCount: 0,
      totalCount: FIELDS.length,
      missing: FIELDS.map((f) => ({ key: f.key, label: f.label, step: f.step })),
      nextField: FIELDS[0],
      suggestion: 'Add a photo and bio so people can find you',
      tier: TIER.low,
    };
  }

  const profile = user.profile || user;
  let totalWeight = 0;
  let earnedWeight = 0;
  let filledCount = 0;
  const missing = [];

  for (const field of FIELDS) {
    totalWeight += field.weight;
    const value = profile[field.key] ?? user[field.key];
    const filled = field.check ? field.check(value) : !!value;
    if (filled) {
      earnedWeight += field.weight;
      filledCount += 1;
    } else {
      missing.push({ key: field.key, label: field.label, step: field.step });
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  const nextField = missing[0] || null;
  const tier = getCompletenessTier(score);

  let suggestion;
  if (!nextField) {
    suggestion = "You're all set — your profile is complete.";
  } else if (score < 40) {
    suggestion = `Add your ${nextField.label.toLowerCase()} so people can find you`;
  } else if (score < 75) {
    suggestion = `Add ${nextField.label.toLowerCase()} — ${missing.length} steps to a complete profile`;
  } else {
    suggestion = `One more thing: ${nextField.label.toLowerCase()}`;
  }

  return {
    score,
    filledCount,
    totalCount: FIELDS.length,
    missing,
    nextField,
    suggestion,
    tier,
  };
}
