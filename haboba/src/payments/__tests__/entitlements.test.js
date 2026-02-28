import {
  hasTierAccess,
  canSeeWhoLikesYou,
  hasUnlimitedLikes,
  canUseAdvancedFilters,
  canUseIncognito,
  hasUnlimitedRewinds,
  isSubscribed,
} from '../entitlements';

describe('entitlements', () => {
  describe('hasTierAccess', () => {
    it('free cannot access gold features', () => {
      expect(hasTierAccess('free', 'gold')).toBe(false);
    });

    it('gold can access gold features', () => {
      expect(hasTierAccess('gold', 'gold')).toBe(true);
    });

    it('royal can access gold features', () => {
      expect(hasTierAccess('royal', 'gold')).toBe(true);
    });

    it('crown can access any tier', () => {
      expect(hasTierAccess('crown', 'gold')).toBe(true);
      expect(hasTierAccess('crown', 'royal')).toBe(true);
      expect(hasTierAccess('crown', 'crown')).toBe(true);
    });
  });

  describe('feature checks', () => {
    it('canSeeWhoLikesYou requires royal', () => {
      expect(canSeeWhoLikesYou('free')).toBe(false);
      expect(canSeeWhoLikesYou('gold')).toBe(false);
      expect(canSeeWhoLikesYou('royal')).toBe(true);
      expect(canSeeWhoLikesYou('crown')).toBe(true);
    });

    it('hasUnlimitedLikes requires gold', () => {
      expect(hasUnlimitedLikes('free')).toBe(false);
      expect(hasUnlimitedLikes('gold')).toBe(true);
    });

    it('canUseAdvancedFilters requires crown', () => {
      expect(canUseAdvancedFilters('royal')).toBe(false);
      expect(canUseAdvancedFilters('crown')).toBe(true);
    });

    it('canUseIncognito requires crown', () => {
      expect(canUseIncognito('royal')).toBe(false);
      expect(canUseIncognito('crown')).toBe(true);
    });

    it('hasUnlimitedRewinds requires gold', () => {
      expect(hasUnlimitedRewinds('free')).toBe(false);
      expect(hasUnlimitedRewinds('gold')).toBe(true);
    });

    it('isSubscribed checks for non-free tier', () => {
      expect(isSubscribed('free')).toBe(false);
      expect(isSubscribed('gold')).toBe(true);
      expect(isSubscribed('royal')).toBe(true);
    });
  });
});
