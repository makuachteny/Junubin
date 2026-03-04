// AnaJunubin — Profile Completeness Calculator
const FIELDS = [
  { key: 'displayName', weight: 15, label: 'Display name' },
  { key: 'bio', weight: 15, label: 'Bio' },
  { key: 'photos', weight: 20, label: 'Photos (at least 3)', check: (v) => Array.isArray(v) ? v.length >= 3 : !!v },
  { key: 'job', weight: 10, label: 'Job title' },
  { key: 'school', weight: 5, label: 'School' },
  { key: 'heightCm', weight: 5, label: 'Height' },
  { key: 'ethnicity', weight: 5, label: 'Ethnicity' },
  { key: 'interests', weight: 10, label: 'Interests', check: (v) => Array.isArray(v) && v.length >= 3 },
  { key: 'datingIntentions', weight: 5, label: 'Dating intentions' },
  { key: 'currentlyInto', weight: 5, label: 'Currently Into', check: (v) => Array.isArray(v) && v.length >= 1 },
  { key: 'city', weight: 5, label: 'Location' },
];

export function calculateCompleteness(user) {
  if (!user) return { score: 0, missing: FIELDS.map((f) => f.label), suggestions: ['Complete your profile to get more matches!'] };

  const profile = user.profile || user;
  let totalWeight = 0;
  let earnedWeight = 0;
  const missing = [];

  for (const field of FIELDS) {
    totalWeight += field.weight;
    const value = profile[field.key] ?? user[field.key];
    const filled = field.check ? field.check(value) : !!value;
    if (filled) {
      earnedWeight += field.weight;
    } else {
      missing.push(field.label);
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

  const suggestions = [];
  if (missing.length > 0) {
    suggestions.push(`Add your ${missing[0].toLowerCase()} to stand out`);
  }
  if (missing.length > 1) {
    suggestions.push(`${missing.length} fields left to complete`);
  }

  return { score, missing, suggestions };
}
