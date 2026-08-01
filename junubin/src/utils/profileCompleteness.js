// JuNubin — Profile Completeness Calculator
//
// Drives the Profile tab's PROFILE STRENGTH card. The checklist is
// exactly the five items from the redesign mock — each worth an equal
// share, so the percent is always `done / 5`, the same math the design
// prototype uses. ProfileScreen renders `missing` as the un-checked
// rows, so the percent and the checks can never disagree.
//
// Accepts either the raw API user (User row with .profile / .photos /
// .isVerified) or the normalized shape from useCurrentUser (.images /
// .verified) — each field's `get` resolves both, because callers pass
// `currentUser._raw || currentUser`.
const FIELDS = [
  {
    key: 'photos',
    label: 'Add a profile photo',
    step: 'photos',
    get: (profile, user) => profile.photos ?? user.photos ?? user.images,
    check: (v) => (Array.isArray(v) ? v.length >= 1 : !!v),
  },
  {
    key: 'ethnicity',
    label: 'Add your background',
    step: 'ethnicity',
    check: (v) => typeof v === 'string' && v.trim().length > 0,
  },
  {
    key: 'languages',
    label: 'Add languages',
    step: 'languages',
    check: (v) => Array.isArray(v) && v.length >= 1,
  },
  {
    key: 'promptAnswer',
    label: 'Answer a profile prompt',
    step: 'prompt',
    check: (v) => typeof v === 'string' && v.trim().length > 0,
  },
  {
    key: 'verified',
    label: 'Verify your photo',
    step: 'verify',
    get: (profile, user) => profile.verified ?? user.verified ?? user.isVerified,
    check: (v) => v === true,
  },
];

// Tier thresholds — retained for any consumer that colors by score.
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
      suggestion: 'Add a photo so people can find you',
      tier: TIER.low,
    };
  }

  const profile = user.profile || user;
  let filledCount = 0;
  const missing = [];

  for (const field of FIELDS) {
    const value = field.get
      ? field.get(profile, user)
      : (profile[field.key] ?? user[field.key]);
    const filled = field.check ? field.check(value) : !!value;
    if (filled) {
      filledCount += 1;
    } else {
      missing.push({ key: field.key, label: field.label, step: field.step });
    }
  }

  const score = Math.round((filledCount / FIELDS.length) * 100);
  const nextField = missing[0] || null;
  const tier = getCompletenessTier(score);

  const suggestion = nextField
    ? nextField.label
    : "You're all set — your profile is complete.";

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
