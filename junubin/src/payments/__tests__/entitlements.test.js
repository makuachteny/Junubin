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
  DAILY_LIKE_LIMIT_BY_TIER,
  getDailyLikeLimit,
} from '../entitlements';

describe('entitlements (paid launch posture)', () => {
  it('ALL_FEATURES_FREE flag is off — paywalls active', () => {
    expect(ALL_FEATURES_FREE).toBe(false);
  });

  describe('hasTierAccess', () => {
    it('blocks free users from paid tiers', () => {
      expect(hasTierAccess('free', 'plus')).toBe(false);
      expect(hasTierAccess('free', 'junub')).toBe(false);
    });

    it('allows access at or above the required tier', () => {
      expect(hasTierAccess('plus', 'plus')).toBe(true);
      expect(hasTierAccess('plus', 'free')).toBe(true);
      expect(hasTierAccess('junub', 'plus')).toBe(true);
      expect(hasTierAccess('junub', 'junub')).toBe(true);
    });

    it('blocks plus users from junub-only features', () => {
      expect(hasTierAccess('plus', 'junub')).toBe(false);
    });
  });

  describe('plus-tier feature checks', () => {
    it.each([
      ['canUseAdvancedFilters', canUseAdvancedFilters],
      ['canUseWhispers', canUseWhispers],
      ['hasUnlimitedRewinds', hasUnlimitedRewinds],
    ])('%s requires plus or higher', (_name, fn) => {
      expect(fn('free')).toBe(false);
      expect(fn('plus')).toBe(true);
      expect(fn('junub')).toBe(true);
    });
  });

  describe('junub-tier feature checks', () => {
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
    it('returns true only for paid tiers', () => {
      expect(isSubscribed('free')).toBe(false);
      expect(isSubscribed(undefined)).toBe(false);
      expect(isSubscribed('plus')).toBe(true);
      expect(isSubscribed('junub')).toBe(true);
    });
  });

  describe('daily like limits', () => {
    it('matches the expected per-tier ceilings', () => {
      expect(DAILY_LIKE_LIMIT_BY_TIER.free).toBe(20);
      expect(DAILY_LIKE_LIMIT_BY_TIER.plus).toBe(50);
      expect(DAILY_LIKE_LIMIT_BY_TIER.junub).toBeNull();
    });

    it('hasUnlimitedLikes is true only for tiers with a null ceiling', () => {
      expect(hasUnlimitedLikes('free')).toBe(false);
      expect(hasUnlimitedLikes('plus')).toBe(false);
      expect(hasUnlimitedLikes('junub')).toBe(true);
    });

    it('getDailyLikeLimit falls back to the free tier for unknown values', () => {
      expect(getDailyLikeLimit('unknown')).toBe(20);
      expect(getDailyLikeLimit(undefined)).toBe(20);
    });
  });
});
