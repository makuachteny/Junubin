// Guards on the city dataset. These are cheap invariants that catch the
// two ways this file realistically breaks: a hand-added row with a typo'd
// coordinate (which puts a seeded profile in the ocean) and a duplicated
// id (which silently drops a city from suggestions and from the generated
// seed, since scripts/generate-city-seed.js keys on id).

import {
  CITIES,
  CITY_GROUPS,
  SOUTH_SUDAN_CITIES,
  DIASPORA_CITIES,
  SUGGESTED_CITIES,
  cityLabel,
  findCity,
  searchCities,
} from '../cities';

describe('cities dataset', () => {
  it('has unique ids', () => {
    const ids = CITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique display labels', () => {
    // Two cities sharing a label would make the picker ambiguous and
    // would collide in User.city, which is what the directory filters on.
    const labels = CITIES.map(cityLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('gives every city a name, country and finite coordinates', () => {
    for (const c of CITIES) {
      expect(typeof c.name).toBe('string');
      expect(c.name.length).toBeGreaterThan(1);
      expect(typeof c.country).toBe('string');
      expect(Number.isFinite(c.latitude)).toBe(true);
      expect(Number.isFinite(c.longitude)).toBe(true);
      expect(Math.abs(c.latitude)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.longitude)).toBeLessThanOrEqual(180);
    }
  });

  it('places every South Sudanese city inside the country bounding box', () => {
    // South Sudan spans roughly 3.5-12.2 N and 24.1-35.9 E. A row that
    // falls outside is a transposed or sign-flipped coordinate.
    for (const c of SOUTH_SUDAN_CITIES) {
      expect(c.countryCode).toBe('SS');
      expect(c.latitude).toBeGreaterThan(3);
      expect(c.latitude).toBeLessThan(13);
      expect(c.longitude).toBeGreaterThan(24);
      expect(c.longitude).toBeLessThan(36);
    }
  });

  it('covers all ten state capitals and the three administrative areas', () => {
    const names = SOUTH_SUDAN_CITIES.map((c) => c.name);
    for (const capital of [
      'Juba', 'Torit', 'Yambio', 'Bor', 'Bentiu',
      'Malakal', 'Kuajok', 'Aweil', 'Wau', 'Rumbek',
      'Abyei', 'Pariang', 'Pibor',
    ]) {
      expect(names).toContain(capital);
    }
  });

  it('splits cleanly into the two groups', () => {
    expect(SOUTH_SUDAN_CITIES.length + DIASPORA_CITIES.length).toBe(CITIES.length);
    for (const c of CITIES) {
      expect([CITY_GROUPS.SOUTH_SUDAN, CITY_GROUPS.DIASPORA]).toContain(c.group);
    }
  });

  it('resolves every suggested id to a real city', () => {
    expect(SUGGESTED_CITIES.length).toBeGreaterThan(0);
    for (const c of SUGGESTED_CITIES) expect(CITIES).toContain(c);
  });
});

describe('cityLabel', () => {
  it('uses the sub-national code where we have one', () => {
    expect(cityLabel(findCity('Minneapolis'))).toBe('Minneapolis, MN');
    expect(cityLabel(findCity('Melbourne'))).toBe('Melbourne, VIC');
  });

  it('falls back to the country otherwise', () => {
    expect(cityLabel(findCity('Juba'))).toBe('Juba, South Sudan');
    expect(cityLabel(findCity('London'))).toBe('London, UK');
  });
});

describe('findCity', () => {
  it('round-trips a full label', () => {
    for (const c of CITIES) {
      expect(findCity(cityLabel(c))).toBe(c);
    }
  });

  it('accepts a bare name, which is what legacy User.city rows hold', () => {
    expect(findCity('Nairobi')?.id).toBe('nairobi');
    expect(findCity('  juba  ')?.id).toBe('juba');
  });

  it('returns null for free-text cities that are not in the list', () => {
    expect(findCity('Wanyjok')).toBeNull();
    expect(findCity('')).toBeNull();
    expect(findCity(undefined)).toBeNull();
  });
});

describe('searchCities', () => {
  it('returns nothing for an empty query so callers can show suggestions', () => {
    expect(searchCities('')).toEqual([]);
    expect(searchCities('   ')).toEqual([]);
  });

  it('ranks an exact match first, ahead of cities that merely contain it', () => {
    // "Bor" is also a substring of Gogrial's neighbours and of several
    // diaspora rows, so this is a real ordering test, not a tautology.
    expect(searchCities('bor')[0].name).toBe('Bor');
  });

  it('ranks a prefix match ahead of a mid-word substring match', () => {
    const results = searchCities('kam');
    expect(results[0].name).toBe('Kampala');
  });

  it('finds a city by its South Sudanese state', () => {
    const results = searchCities('Jonglei');
    expect(results.map((c) => c.name)).toContain('Bor');
  });

  it('finds a city by country', () => {
    const results = searchCities('Kenya', 20);
    expect(results.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Nairobi', 'Kakuma', 'Eldoret']),
    );
  });

  it('honours the limit', () => {
    expect(searchCities('a', 3)).toHaveLength(3);
  });

  it('is case and whitespace insensitive', () => {
    expect(searchCities('  JUBA ')[0].id).toBe('juba');
  });
});
