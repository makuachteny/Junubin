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
//   DATE_PREF_OPTIONS → Profile.lookingForGender
//   INTENTION_OPTIONS → Profile.datingIntentions
//   SEXUALITY_OPTIONS → Profile.sexuality
//   CHILDREN_OPTIONS  → Profile.children
// If you change a value here, also update any seed/mock data that
// persists the old wording (src/data/__dev__/mockProfiles.js, etc.).

export const PRONOUN_OPTIONS = ['she/her/hers', 'he/him/his', 'they/them/theirs', 'ze/zir/zirs'];

export const DATE_PREF_OPTIONS = ['Men', 'Women', 'Everyone'];

export const INTENTION_OPTIONS = [
  'Life partner',
  'Long-term relationship',
  'Short-term relationship',
  'Figuring it out',
  'Prefer not to say',
];

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
  'The way to my heart is...',
  'A fun fact about me is...',
  'My ideal Sunday looks like...',
  "I'm looking for someone who...",
  'My most controversial opinion is...',
  'Two truths and a lie...',
  'I get along best with people who...',
  'My love language is...',
];

export const SEXUALITY_OPTIONS = [
  'Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Prefer not to say',
];

export const CHILDREN_OPTIONS = [
  'No children',
  'Have children',
  'Want children someday',
  "Don't want children",
  'Open to children',
  'Prefer not to say',
];
