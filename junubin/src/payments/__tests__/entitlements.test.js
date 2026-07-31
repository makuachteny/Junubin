// JuNubin is free: every entitlement helper is a shim that grants
// access to everyone. These tests exist to catch a regression that
// reintroduces a paywall — if any of them start failing because a
// helper returned `false`, someone put a gate back in.

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
import { PAYMENTS_ENABLED, SHOW_PAYMENTS_UI } from '../comingSoon';
import { PRODUCTS, PRODUCT_IDS, RETIRED_PRODUCT_IDS } from '../products';

// Every tier value a caller might realistically pass, including the
// unauthenticated/unknown cases that used to fall through to `free`.
const TIERS = ['free', 'plus', 'junub', 'unknown', undefined, null];

describe('entitlements — the app is free', () => {
  it('ALL_FEATURES_FREE is on; this is permanent, not a launch toggle', () => {
    expect(ALL_FEATURES_FREE).toBe(true);
  });

  it('no payment rail or payment UI is enabled', () => {
    expect(PAYMENTS_ENABLED).toBe(false);
    expect(SHOW_PAYMENTS_UI).toBe(false);
  });

  describe('hasTierAccess', () => {
    it('grants every tier access to every requirement', () => {
      for (const current of TIERS) {
        for (const required of ['free', 'plus', 'junub']) {
          expect(hasTierAccess(current, required)).toBe(true);
        }
      }
    });
  });

  describe('feature helpers', () => {
    it.each([
      ['canUseAdvancedFilters', canUseAdvancedFilters],
      ['canUseIncognito', canUseIncognito],
      ['canUseDiasporaConnect', canUseDiasporaConnect],
      // Deprecated dating shims — kept so callers don't break.
      ['canSeeWhoLikesYou', canSeeWhoLikesYou],
      ['canUseWhispers', canUseWhispers],
      ['hasUnlimitedLikes', hasUnlimitedLikes],
      ['hasUnlimitedRewinds', hasUnlimitedRewinds],
    ])('%s is true for every tier', (_name, fn) => {
      for (const tier of TIERS) {
        expect(fn(tier)).toBe(true);
      }
    });
  });

  describe('isSubscribed', () => {
    it('treats everyone as fully entitled', () => {
      for (const tier of TIERS) {
        expect(isSubscribed(tier)).toBe(true);
      }
    });
  });

  describe('daily like limits (deprecated shims)', () => {
    it('is uncapped for every tier — there are no daily limits', () => {
      for (const tier of TIERS) {
        expect(getDailyLikeLimit(tier)).toBeNull();
      }
    });

    it('exposes no numeric ceiling anywhere in the tier map', () => {
      for (const limit of Object.values(DAILY_LIKE_LIMIT_BY_TIER)) {
        expect(limit).toBeNull();
      }
    });
  });
});

describe('product catalog — nothing dating is sellable', () => {
  it('sells no consumables at all', () => {
    const consumables = Object.values(PRODUCTS).filter((p) => p.type === 'consumable');
    expect(consumables).toEqual([]);
  });

  it('has no super-like, spotlight, or coin product in the catalog', () => {
    for (const id of Object.keys(PRODUCTS)) {
      expect(id).not.toMatch(/superlike|spotlight|coins/);
    }
    for (const id of Object.values(PRODUCT_IDS)) {
      expect(id).not.toMatch(/superlike|spotlight|coins/);
    }
  });

  it('keeps the retired identifiers resolvable for historical receipts', () => {
    expect(RETIRED_PRODUCT_IDS.SUPERLIKE_5).toBe('com.junubin.superlike.5');
    expect(RETIRED_PRODUCT_IDS.SPOTLIGHT_1).toBe('com.junubin.spotlight.1');
    expect(RETIRED_PRODUCT_IDS.COINS_100).toBe('com.junubin.coins.100');
  });

  it('keeps live subscription identifiers unchanged so nothing already live breaks', () => {
    expect(PRODUCT_IDS.PLUS_MONTHLY).toBe('com.junubin.sub.plus.monthly');
    expect(PRODUCT_IDS.PLUS_6MONTH).toBe('com.junubin.sub.plus.6month');
    expect(PRODUCT_IDS.JUNUB_MONTHLY).toBe('com.junubin.sub.junub.monthly');
    expect(PRODUCT_IDS.JUNUB_6MONTH).toBe('com.junubin.sub.junub.6month');
  });
});
