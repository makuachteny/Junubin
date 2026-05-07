import { mockProfiles } from '../data/mockProfiles';

describe('Mock Profiles — Mode & Social Data', () => {
  it('every profile has a mode field', () => {
    mockProfiles.forEach((p) => {
      expect(['Dating', 'Social', 'Both']).toContain(p.mode);
    });
  });

  it('has profiles in Dating mode', () => {
    const dating = mockProfiles.filter((p) => p.mode === 'Dating');
    expect(dating.length).toBeGreaterThan(0);
  });

  it('has profiles in Social mode', () => {
    const social = mockProfiles.filter((p) => p.mode === 'Social');
    expect(social.length).toBeGreaterThan(0);
  });

  it('has profiles in Both mode', () => {
    const both = mockProfiles.filter((p) => p.mode === 'Both');
    expect(both.length).toBeGreaterThan(0);
  });

  it('Social/Both profiles have socialBio or socialIntention', () => {
    const socialProfiles = mockProfiles.filter((p) => p.mode === 'Social' || p.mode === 'Both');
    socialProfiles.forEach((p) => {
      const hasSocialField = p.socialBio || p.socialIntention;
      expect(hasSocialField).toBeTruthy();
    });
  });

  it('every profile has required fields', () => {
    mockProfiles.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.age).toBeGreaterThan(0);
      expect(p.images.length).toBeGreaterThan(0);
      expect(p.ethnicity).toBeTruthy();
      expect(p.height).toBeTruthy();
    });
  });

  it('profiles have valid ethnicity values', () => {
    const validEthnicities = ['Dinka', 'Nuer', 'Bari', 'Shilluk', 'Azande', 'Mundari', 'Acholi', 'Lotuko', 'Toposa', 'Murle', 'Madi', 'Other'];
    mockProfiles.forEach((p) => {
      expect(validEthnicities).toContain(p.ethnicity);
    });
  });
});
