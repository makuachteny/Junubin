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
  // Hybrid mode for build 19: ALL_FEATURES_FREE = true so every
  // entitlement check unlocks, BUT SHOW_PAYMENTS_UI = true so the
  // paywall surfaces render. Apple sees the buttons; users get the
  // features without a real purchase round-trip. Flip ALL_FEATURES_FREE
  // back to false the moment RevenueCat keys are wired and a sandbox
  // transaction has been verified end-to-end.
  it('ALL_FEATURES_FREE flag is on (paid UI shown, gates bypassed)', () => {
    expect(ALL_FEATURES_FREE).toBe(true);
  });

  describe('hasTierAccess (free-for-all)', () => {
    it('returns true for any tier combination while the flag is on', () => {
      expect(hasTierAccess('free', 'plus')).toBe(true);
      expect(hasTierAccess('free', 'junub')).toBe(true);
      expect(hasTierAccess('plus', 'plus')).toBe(true);
      expect(hasTierAccess('junub', 'junub')).toBe(true);
    });
  });

  describe('feature checks (free-for-all)', () => {
    it.each([
      ['canSeeWhoLikesYou', canSeeWhoLikesYou],
      ['hasUnlimitedLikes', hasUnlimitedLikes],
      ['canUseAdvancedFilters', canUseAdvancedFilters],
      ['canUseIncognito', canUseIncognito],
      ['hasUnlimitedRewinds', hasUnlimitedRewinds],
      ['canUseWhispers', canUseWhispers],
      ['canUseDiasporaConnect', canUseDiasporaConnect],
      ['isSubscribed', isSubscribed],
    ])('%s returns true regardless of tier', (_name, fn) => {
      expect(fn('free')).toBe(true);
      expect(fn('plus')).toBe(true);
      expect(fn('junub')).toBe(true);
      expect(fn(undefined)).toBe(true);
    });
  });
});
