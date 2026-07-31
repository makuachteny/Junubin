// Guard for the free-app cleanup: the payments module was gutted
// (nothing is sold any more) but screens across the app still import
// from this barrel, and several of those screens are being rewritten
// concurrently. Deleting an export here surfaces as `undefined is not
// a function` deep inside an unrelated screen, so pin the public
// surface until every caller has actually been migrated.

import * as payments from '../index';

const REQUIRED = [
  'PRODUCT_IDS', 'PRODUCTS', 'TIER_RANK', 'ENTITLEMENTS', 'OFFERING_ID', 'tierFromEntitlements',
  'hasTierAccess', 'canSeeWhoLikesYou', 'hasUnlimitedLikes', 'canUseAdvancedFilters',
  'canUseIncognito', 'hasUnlimitedRewinds', 'canUseWhispers', 'canUseDiasporaConnect',
  'isSubscribed', 'ALL_FEATURES_FREE', 'PAYMENTS_ENABLED', 'SHOW_PAYMENTS_UI',
  'showPaymentsComingSoon', 'PaymentService', 'SubscriptionProvider', 'useSubscription',
  'useSubscriptionState', 'useSubscriptionActions', 'StripeService', 'FlutterwaveService',
  'PAYMENT_METHODS', 'PAYMENT_METHOD_LABELS', 'PAYMENT_METHOD_ICONS', 'PAYMENT_METHOD_COLORS',
  'getAvailableMethods',
];

it('barrel still exports every symbol the app imports', () => {
  const missing = REQUIRED.filter((k) => payments[k] === undefined);
  expect(missing).toEqual([]);
});
