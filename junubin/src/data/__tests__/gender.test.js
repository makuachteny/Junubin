import {
  GENDER_OPTIONS,
  GENDER_DB_VALUES,
  toDbGender,
  toUiGender,
} from '../gender';

describe('gender map (guards the "invalid value for enum: Gender" bug)', () => {
  it('every UI option maps to a valid DB enum value', () => {
    GENDER_OPTIONS.forEach((label) => {
      const db = toDbGender(label);
      expect(db).not.toBeNull();
      expect(GENDER_DB_VALUES).toContain(db);
    });
  });

  it('toDbGender lowercases the picker labels to enum values', () => {
    expect(toDbGender('Man')).toBe('man');
    expect(toDbGender('Woman')).toBe('woman');
    expect(toDbGender('Nonbinary')).toBe('non_binary');
  });

  it('never returns a capitalized label that the DB would reject', () => {
    GENDER_OPTIONS.forEach((label) => {
      expect(GENDER_DB_VALUES).toContain(toDbGender(label));
    });
  });

  it('round-trips DB <-> UI losslessly for picker values', () => {
    GENDER_OPTIONS.forEach((label) => {
      expect(toUiGender(toDbGender(label))).toBe(label);
    });
  });

  it('handles unknown / empty input safely', () => {
    expect(toDbGender('')).toBeNull();
    expect(toDbGender(undefined)).toBeNull();
    expect(toUiGender('other')).toBe('');
    expect(toUiGender('')).toBe('');
    expect(toUiGender('bogus')).toBe('');
  });
});
