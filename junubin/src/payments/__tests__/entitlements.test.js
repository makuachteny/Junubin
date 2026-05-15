import {
  hasTierAccess,
  canSeeWhoLikesYou,
  hasUnlimitedLikes,
  canUseAdvancedFilters,
  canUseIncognito,
  hasUnlimitedRewinds,
  canUseWhispers,
  canUseDiasporaConnect,
  isSubscribed,
  ALL_FEATURES_FREE,
} from '../entitlements';

describe('entitlements', () => {
  // Paid features are on as of build 18. ALL_FEATURES_FREE is now off
  // and every entitlement check enforces the tier hierarchy:
  //   free  →  plus (JuNubin+)  →  junub (premium)
  it('ALL_FEATURES_FREE flag is off — payments are live', () => {
    expect(ALL_FEATURES_FREE).toBe(false);
  });

  describe('hasTierAccess', () => {
    it('lets equal or higher tiers through, blocks lower', () => {
      expect(hasTierAccess('free', 'plus')).toBe(false);
      expect(hasTierAccess('free', 'junub')).toBe(false);
      expect(hasTierAccess('plus', 'plus')).toBe(true);
      expect(hasTierAccess('plus', 'junub')).toBe(false);
      expect(hasTierAccess('junub', 'plus')).toBe(true);
      expect(hasTierAccess('junub', 'junub')).toBe(true);
    });

    it('treats unknown tiers as free', () => {
      expect(hasTierAccess(undefined, 'plus')).toBe(false);
      expect(hasTierAccess(null, 'plus')).toBe(false);
      expect(hasTierAccess('mystery', 'plus')).toBe(false);
    });
  });

  describe('plus-tier features', () => {
    it.each([
      ['hasUnlimitedLikes', hasUnlimitedLikes],
      ['hasUnlimitedRewinds', hasUnlimitedRewinds],
      ['canUseWhispers', canUseWhispers],
      ['canUseAdvancedFilters', canUseAdvancedFilters],
    ])('%s requires plus or higher', (_name, fn) => {
      expect(fn('free')).toBe(false);
      expect(fn('plus')).toBe(true);
      expect(fn('junub')).toBe(true);
    });
  });

  describe('junub-tier features', () => {
    it.each([
      ['canSeeWhoLikesYou', canSeeWhoLikesYou],
      ['canUseIncognito', canUseIncognito],
      ['canUseDiasporaConnect', canUseDiasporaConnect],
    ])('%s requires junub', (_name, fn) => {
      expect(fn('free')).toBe(false);
      expect(fn('plus')).toBe(false);
      expect(fn('junub')).toBe(true);
    });
  });

  describe('isSubscribed', () => {
    it('is true for any paid tier, false for free / undefined', () => {
      expect(isSubscribed('free')).toBe(false);
      expect(isSubscribed(undefined)).toBe(false);
      expect(isSubscribed('plus')).toBe(true);
      expect(isSubscribed('junub')).toBe(true);
    });
  });
});
