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
  // The v1 launch ships with ALL_FEATURES_FREE = true: every premium
  // entitlement is unlocked for every user regardless of subscription
  // tier. The tests below reflect that. When payments go live and the
  // flag flips back to false, restore the per-tier expectations from
  // the git history (commit `1abf3d7` has the original assertions).
  it('ALL_FEATURES_FREE flag is on for v1 launch', () => {
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
