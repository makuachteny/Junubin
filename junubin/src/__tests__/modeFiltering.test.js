import { mockProfiles } from '../data/mockProfiles';

// Replicate the buildDeck logic from HomeScreen
const buildDeck = (mode = 'Dating') => {
  return mockProfiles.filter((p) => {
    if (!p || !p.id || !p.name || !p.images?.length) return false;
    if (mode === 'Dating') return p.mode === 'Dating' || p.mode === 'Both';
    if (mode === 'Social') return p.mode === 'Social' || p.mode === 'Both';
    return true;
  });
};

describe('Mode-based deck filtering', () => {
  it('Dating mode includes Dating and Both profiles', () => {
    const deck = buildDeck('Dating');
    deck.forEach((p) => {
      expect(['Dating', 'Both']).toContain(p.mode);
    });
    expect(deck.length).toBeGreaterThan(0);
  });

  it('Social mode includes Social and Both profiles', () => {
    const deck = buildDeck('Social');
    deck.forEach((p) => {
      expect(['Social', 'Both']).toContain(p.mode);
    });
    expect(deck.length).toBeGreaterThan(0);
  });

  it('Dating mode excludes Social-only profiles', () => {
    const deck = buildDeck('Dating');
    const socialOnly = mockProfiles.filter((p) => p.mode === 'Social');
    socialOnly.forEach((sp) => {
      expect(deck.find((d) => d.id === sp.id)).toBeUndefined();
    });
  });

  it('Social mode excludes Dating-only profiles', () => {
    const deck = buildDeck('Social');
    const datingOnly = mockProfiles.filter((p) => p.mode === 'Dating');
    datingOnly.forEach((dp) => {
      expect(deck.find((d) => d.id === dp.id)).toBeUndefined();
    });
  });

  it('Both-mode profiles appear in both decks', () => {
    const bothProfiles = mockProfiles.filter((p) => p.mode === 'Both');
    const datingDeck = buildDeck('Dating');
    const socialDeck = buildDeck('Social');
    bothProfiles.forEach((bp) => {
      expect(datingDeck.find((d) => d.id === bp.id)).toBeTruthy();
      expect(socialDeck.find((d) => d.id === bp.id)).toBeTruthy();
    });
  });
});

describe('Filter application', () => {
  it('filters by ethnicity', () => {
    const dinka = mockProfiles.filter((p) => p.ethnicity === 'Dinka');
    expect(dinka.length).toBeGreaterThan(0);
    const nuer = mockProfiles.filter((p) => p.ethnicity === 'Nuer');
    expect(nuer.length).toBeGreaterThan(0);
  });

  it('filters by education', () => {
    const bachelors = mockProfiles.filter((p) => p.education === "Bachelor's degree");
    expect(bachelors.length).toBeGreaterThan(0);
  });

  it('filters by verified status', () => {
    const verified = mockProfiles.filter((p) => p.verified === true);
    const unverified = mockProfiles.filter((p) => p.verified === false);
    expect(verified.length).toBeGreaterThan(0);
    expect(unverified.length).toBeGreaterThan(0);
  });

  it('filters by distance', () => {
    const nearby = mockProfiles.filter((p) => p.distance <= 5);
    expect(nearby.length).toBeGreaterThan(0);
  });
});
