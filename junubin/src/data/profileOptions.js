// Shared profile option vocabularies used by BOTH the onboarding survey
// (ProfileSetupScreen) and EditProfileScreen. Keeping them in one place
// guarantees a value saved during the survey shows as selected in Edit
// Profile — if the two screens defined their own lists and one drifted,
// the saved string wouldn't match a chip and would render unselected
// (the same class of bug we hit with gender). Values must stay
// byte-identical to what's persisted to the corresponding Profile / User
// columns:
//   PRONOUN_OPTIONS   → Profile.pronouns          (joined w/ ", ")
//   EDUCATION_OPTIONS → Profile.education
//   INTEREST_OPTIONS  → Profile.interests         (JSONB array)
//   PROMPT_OPTIONS    → Profile.promptQuestion
//   HERE_FOR_OPTIONS  → Profile.lookingFor
//   LOCATION_VISIBILITY_OPTIONS → Profile.locationVisibility
// If you change a value here, also update any seed/mock data that
// persists the old wording (src/data/__dev__/mockProfiles.js, etc.).
//
// See also the two vocabularies that live in their own files because
// they're long enough to deserve one:
//   src/data/openTo.js    → Profile.openTo    (JSONB array of keys)
//   src/data/languages.js → Profile.languages (JSONB array of labels)

export const PRONOUN_OPTIONS = ['she/her/hers', 'he/him/his', 'they/them/theirs', 'ze/zir/zirs'];

export const EDUCATION_OPTIONS = [
  'High school',
  'Some college',
  'Associate degree',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate',
  'Trade school',
  'Prefer not to say',
];

export const INTEREST_OPTIONS = [
  'Cooking', 'Basketball', 'Music', 'Travel', 'Fashion', 'Faith', 'Fitness', 'Tech',
  'Art', 'Reading', 'Movies', 'Gaming', 'Dancing', 'Business', 'Photography', 'Soccer',
  'Poetry', 'Singing', 'Running', 'Volunteering', 'Food', 'Nature', 'Languages', 'History',
];

export const PROMPT_OPTIONS = [
  'A fun fact about me is...',
  'My ideal Sunday looks like...',
  'The dish that tastes like home is...',
  'Where I grew up, everyone knows...',
  "If you're new to my city, I'd tell you...",
  'A tradition I never want to lose is...',
  'I get along best with people who...',
  'My most controversial opinion is...',
  'Two truths and a lie...',
];

// Location privacy — the consent step that closes onboarding, mirrored
// by the Settings control. This is an IN-APP choice about what other
// people see; it is not, and must never be wired to, an OS location
// permission prompt. Default is 'off' for everyone.
export const LOCATION_VISIBILITY_OPTIONS = [
  {
    key: 'off',
    label: 'Off',
    icon: 'eye-off-outline',
    description: 'Stay hidden. You can still browse the map.',
  },
  {
    key: 'city',
    label: 'City only',
    icon: 'business-outline',
    description: 'Show my city only. No map pin.',
  },
  {
    key: 'coarse',
    label: 'Approximate area',
    icon: 'location-outline',
    description: 'Show me on the map at an approximate area (~1 km), never my exact address.',
  },
];

export const LOCATION_VISIBILITY_KEYS = LOCATION_VISIBILITY_OPTIONS.map((o) => o.key);

/**
 * Un-migrated backends return null for Profile.locationVisibility.
 * Everything falls back to the private default rather than guessing.
 */
export function normalizeLocationVisibility(value) {
  return LOCATION_VISIBILITY_KEYS.includes(value) ? value : 'off';
}

// Persists to Profile.lookingFor.
export const HERE_FOR_OPTIONS = [
  'Friendship',
  'Community',
  'Networking',
  'Mentorship',
  'Events & meetups',
  'Just browsing',
];
