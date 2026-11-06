// Static "identity sticker" catalogue surfaced on EditProfile.
// Users pick up to 5 from this list; the selected entries persist on
// `Profile.stickers` (JSON). Not user-generated content — this is the
// vocabulary the product offers, vetted by the moderation team.
//
// Tribes (Dinka, Nuer, Shilluk, Bari, …) live on the Ethnicity field,
// not here — keep this list to thematic / interest-shaped tags so a
// user's ethnicity isn't double-categorised in two places.

export const CULTURAL_STICKERS = [
  { emoji: '🌍',  label: 'Junub' },
  { emoji: '🎭',  label: 'Cultural' },
  { emoji: '💃',  label: 'Dance' },
  { emoji: '🥘',  label: 'Foodie' },
  { emoji: '⚽',  label: 'Sports' },
  { emoji: '✝️', label: 'Faith' },
];
