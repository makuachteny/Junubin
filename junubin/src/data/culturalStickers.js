// Static "identity sticker" catalogue surfaced on EditProfile.
// Users pick up to 5 from this list; the selected entries persist on
// `Profile.stickers` (JSON). Not user-generated content — this is the
// vocabulary the product offers, vetted by the moderation team.
//
// Add new sticker entries here (and only here) — don't seed them from
// the deleted mock-profiles bundle. Order is intentional: ethnic-tribe
// stickers first, then thematic identity tags.

export const CULTURAL_STICKERS = [
  { emoji: '🦁',  label: 'Dinka' },
  { emoji: '🐆',  label: 'Nuer' },
  { emoji: '🏛️', label: 'Shilluk' },
  { emoji: '🌿',  label: 'Bari' },
  { emoji: '🌍',  label: 'Junub' },
  { emoji: '🎭',  label: 'Cultural' },
  { emoji: '💃',  label: 'Dance' },
  { emoji: '🥘',  label: 'Foodie' },
  { emoji: '⚽',  label: 'Sports' },
  { emoji: '✝️', label: 'Faith' },
];
