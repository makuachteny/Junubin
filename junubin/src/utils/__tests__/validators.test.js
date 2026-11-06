import { validateEmail, validatePhoneDigits, validateName } from '../validators';

describe('validateEmail', () => {
  // The regression that triggered this whole pass: the previous regex
  // required at least three dot-separated labels in the domain part, so
  // `you@example.com` was rejected with "Please enter a valid email address."
  it.each([
    'you@example.com',
    'you@gmail.com',
    'a@b.co',
    'first.last@example.com',
    'name+tag@sub.example.com',
    'a.b.c@mail.example.co.uk',
    'dev@a-b.io',
    'TEST@EXAMPLE.COM',
    '   spaces@example.com   ',
  ])('accepts valid email %p', (input) => {
    expect(validateEmail(input)).toBeNull();
  });

  it.each([
    ['', 'Please enter your email address.'],
    ['notanemail', 'Please enter a valid email address.'],
    ['missing@tld', 'Please enter a valid email address.'],
    ['@example.com', 'Please enter a valid email address.'],
    ['you@@example.com', 'Please enter a valid email address.'],
    ['you@example..com', 'Please enter a valid email address.'],
    ['.you@example.com', 'Please enter a valid email address.'],
    ['you@example.com.', 'Please enter a valid email address.'],
    ['you@-example.com', 'Please enter a valid email address.'],
    ['you@example.c', 'Please enter a valid email address.'],
  ])('rejects %p with %p', (input, expected) => {
    expect(validateEmail(input)).toBe(expected);
  });

  it('rejects emails over 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.co';
    expect(validateEmail(long)).toBe('Email is too long.');
  });
});

describe('validatePhoneDigits', () => {
  // E.164: national number is 7-15 digits. Pre-fix, the floor was 10
  // which rejected valid Kenyan (9), Ugandan (9), South Sudanese (9)
  // mobile numbers after stripping the leading zero.
  it.each([
    '7123456',         // 7 digits — minimum
    '712345678',       // 9 digits — Kenyan / SS mobile after dropping leading 0
    '5551234567',      // 10 digits — US format
    '07123 456 789',   // separators ignored
    '+1 (555) 123-4567', // mixed format, country code chars stripped
  ])('accepts valid phone %p', (input) => {
    expect(validatePhoneDigits(input)).toBeNull();
  });

  it.each([
    ['', 'Please enter your phone number.'],
    ['---', 'Please enter your phone number.'],
    ['12345', 'Phone number is too short.'],
    ['1'.repeat(16), 'Phone number is too long.'],
  ])('rejects %p with %p', (input, expected) => {
    expect(validatePhoneDigits(input)).toBe(expected);
  });
});

describe('validateName', () => {
  // The South Sudanese community uses Latin diacritics and Dinka script
  // (Ŋ, Ɣ). The previous [a-zA-Z] regex was rejecting these names.
  it.each([
    'Adau',
    'Núñez',
    'Aŋany',
    "O'Connor",
    'Mary-Jane',
    'JoséRamón',
    'Ngor Ɣɛr',
    '李明',  // Chinese
    'محمد', // Arabic
  ])('accepts valid name %p', (input) => {
    expect(validateName(input)).toBeNull();
  });

  it('rejects empty', () => {
    expect(validateName('')).toBe('Please enter your first name.');
    expect(validateName('   ')).toBe('Please enter your first name.');
  });

  it('rejects too short', () => {
    expect(validateName('A')).toBe('Name must be at least 2 characters.');
  });

  it('rejects too long', () => {
    expect(validateName('A'.repeat(31))).toBe('Name cannot exceed 30 characters.');
  });

  it('rejects names containing digits', () => {
    expect(validateName('Adau42')).toBe('Name can only contain letters, spaces, hyphens, and apostrophes.');
  });

  it('rejects names containing punctuation', () => {
    expect(validateName('Adau@')).toBe('Name can only contain letters, spaces, hyphens, and apostrophes.');
  });
});
