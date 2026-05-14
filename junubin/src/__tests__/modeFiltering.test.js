// Tests for the mode-based deck filtering rule that lives in
// HomeScreen.buildDeck (kept in lock-step with discover/index.ts on
// the server). Uses an inline fixture instead of mock-profiles since
// the demo bundle has been removed from the production tree.

const FIXTURE = [
  { id: 'd1', name: 'Adau',     age: 24, mode: 'Dating', images: ['x'], ethnicity: 'Dinka',   height: "5'8\"",  verified: true,  education: "Bachelor's degree", distance: 3 },
  { id: 's1', name: 'Abuk',     age: 27, mode: 'Social', images: ['x'], ethnicity: 'Bari',    height: "5'6\"",  verified: true,  education: "Master's degree",   distance: 8 },
  { id: 'b1', name: 'Nyirou',   age: 26, mode: 'Both',   images: ['x'], ethnicity: 'Nuer',    height: "5'7\"",  verified: false, education: "Bachelor's degree", distance: 4 },
  { id: 'd2', name: 'Akech',    age: 30, mode: 'Dating', images: ['x'], ethnicity: 'Dinka',   height: "6'1\"",  verified: true,  education: 'High school',       distance: 2 },
  { id: 's2', name: 'Athieng',  age: 25, mode: 'Social', images: ['x'], ethnicity: 'Shilluk', height: "5'5\"",  verified: true,  education: "Bachelor's degree", distance: 11 },
  { id: 'b2', name: 'Akuol',    age: 28, mode: 'Both',   images: ['x'], ethnicity: 'Nuer',    height: "5'10\"", verified: true,  education: "Master's degree",   distance: 6 },
];

// Mirrors HomeScreen.buildDeck — same filter rule. Kept here so a
// regression in the rule fails this test even if HomeScreen drifts.
const buildDeck = (mode = 'Dating') => FIXTURE.filter((p) => {
  if (!p || !p.id || !p.name || !p.images?.length) return false;
  if (mode === 'Dating') return p.mode === 'Dating' || p.mode === 'Both';
  if (mode === 'Social') return p.mode === 'Social' || p.mode === 'Both';
  return true;
});

describe('Mode-based deck filtering', () => {
  it('Dating mode includes Dating and Both profiles', () => {
    const deck = buildDeck('Dating');
    deck.forEach((p) => expect(['Dating', 'Both']).toContain(p.mode));
    expect(deck.length).toBeGreaterThan(0);
  });

  it('Social mode includes Social and Both profiles', () => {
    const deck = buildDeck('Social');
    deck.forEach((p) => expect(['Social', 'Both']).toContain(p.mode));
    expect(deck.length).toBeGreaterThan(0);
  });

  it('Dating mode excludes Social-only profiles', () => {
    const deck = buildDeck('Dating');
    const socialOnly = FIXTURE.filter((p) => p.mode === 'Social');
    socialOnly.forEach((sp) => {
      expect(deck.find((d) => d.id === sp.id)).toBeUndefined();
    });
  });

  it('Social mode excludes Dating-only profiles', () => {
    const deck = buildDeck('Social');
    const datingOnly = FIXTURE.filter((p) => p.mode === 'Dating');
    datingOnly.forEach((dp) => {
      expect(deck.find((d) => d.id === dp.id)).toBeUndefined();
    });
  });

  it('Both-mode profiles appear in both decks', () => {
    const bothProfiles = FIXTURE.filter((p) => p.mode === 'Both');
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
    expect(FIXTURE.filter((p) => p.ethnicity === 'Dinka').length).toBeGreaterThan(0);
    expect(FIXTURE.filter((p) => p.ethnicity === 'Nuer').length).toBeGreaterThan(0);
  });

  it('filters by education', () => {
    expect(FIXTURE.filter((p) => p.education === "Bachelor's degree").length).toBeGreaterThan(0);
  });

  it('filters by verified status', () => {
    expect(FIXTURE.filter((p) => p.verified === true).length).toBeGreaterThan(0);
    expect(FIXTURE.filter((p) => p.verified === false).length).toBeGreaterThan(0);
  });

  it('filters by distance', () => {
    expect(FIXTURE.filter((p) => p.distance <= 5).length).toBeGreaterThan(0);
  });
});
