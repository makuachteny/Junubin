import {
  hasTierAccess,
  canSeeWhoLikesYou,
  hasUnlimitedLikes,
  canUseAdvancedFilters,
  canUseIncognito,
  hasUnlimitedRewinds,
  canUseDiasporaConnect,
  isSubscribed,
} from '../entitlements';

describe('entitlements', () => {
  describe('hasTierAccess', () => {
    it('free cannot access plus features', () => {
      expect(hasTierAccess('free', 'plus')).toBe(false);
    });

    it('plus can access plus features', () => {
      expect(hasTierAccess('plus', 'plus')).toBe(true);
    });

    it('junub can access plus features', () => {
      expect(hasTierAccess('junub', 'plus')).toBe(true);
    });

    it('junub can access any tier', () => {
      expect(hasTierAccess('junub', 'plus')).toBe(true);
      expect(hasTierAccess('junub', 'junub')).toBe(true);
    });
  });

  describe('feature checks', () => {
    it('canSeeWhoLikesYou requires junub', () => {
      expect(canSeeWhoLikesYou('free')).toBe(false);
      expect(canSeeWhoLikesYou('plus')).toBe(false);
      expect(canSeeWhoLikesYou('junub')).toBe(true);
    });

    it('hasUnlimitedLikes requires plus', () => {
      expect(hasUnlimitedLikes('free')).toBe(false);
      expect(hasUnlimitedLikes('plus')).toBe(true);
    });

    it('canUseAdvancedFilters requires junub', () => {
      expect(canUseAdvancedFilters('plus')).toBe(false);
      expect(canUseAdvancedFilters('junub')).toBe(true);
    });

    it('canUseIncognito requires junub', () => {
      expect(canUseIncognito('plus')).toBe(false);
      expect(canUseIncognito('junub')).toBe(true);
    });

    it('canUseDiasporaConnect requires junub', () => {
      expect(canUseDiasporaConnect('free')).toBe(false);
      expect(canUseDiasporaConnect('plus')).toBe(false);
      expect(canUseDiasporaConnect('junub')).toBe(true);
    });

    it('hasUnlimitedRewinds requires plus', () => {
      expect(hasUnlimitedRewinds('free')).toBe(false);
      expect(hasUnlimitedRewinds('plus')).toBe(true);
    });

    it('isSubscribed checks for non-free tier', () => {
      expect(isSubscribed('free')).toBe(false);
      expect(isSubscribed('plus')).toBe(true);
      expect(isSubscribed('junub')).toBe(true);
    });
  });
});
