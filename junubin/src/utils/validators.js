// Shared field validators. Each returns null when valid, or a short
// user-facing string explaining what's wrong. Centralised so the same rules
// run in Signup, ProfileSetup, EditProfile etc. — and so we can lock the
// rules in with unit tests instead of inline regex hidden in components.

// Domain part: one or more dot-separated labels, each starting and ending
// with alphanumeric (hyphens allowed inside). Final TLD must be ≥2 letters.
// The middle group uses `*` (zero or more) so two-segment domains like
// `example.com` pass — earlier `+` required `mail.example.com` minimum.
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function validateEmail(input) {
  const trimmed = String(input || '').trim().toLowerCase();
  if (trimmed.length === 0) return 'Please enter your email address.';
  if (trimmed.length > 254) return 'Email is too long.';
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return 'Please enter a valid email address.';
  }
  if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address.';
  return null;
}

// Phone validators take the local-number digits (after the country picker
// has handled the dial code). E.164 caps the national-number length at 15
// and Kenyan / Ugandan / South Sudanese mobiles can be as short as 7-9
// after the leading 0 is dropped, so anything in [7, 15] is accepted.
export function validatePhoneDigits(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 0) return 'Please enter your phone number.';
  if (digits.length < 7) return 'Phone number is too short.';
  if (digits.length > 15) return 'Phone number is too long.';
  return null;
}

// Unicode-aware: \p{L} covers any letter including Latin diacritics and
// Dinka characters Ŋ/Ɣ; \p{M} catches combining marks. The earlier
// [a-zA-Z] regex was rejecting legitimate names like "Aŋany" or "Núñez".
const NAME_REGEX = /^[\p{L}\p{M}\s'-]+$/u;

export function validateName(input, { min = 2, max = 30 } = {}) {
  const name = String(input || '').trim();
  if (name.length === 0) return 'Please enter your first name.';
  if (name.length < min) return `Name must be at least ${min} characters.`;
  if (name.length > max) return `Name cannot exceed ${max} characters.`;
  if (!NAME_REGEX.test(name)) {
    return 'Name can only contain letters, spaces, hyphens, and apostrophes.';
  }
  return null;
}
