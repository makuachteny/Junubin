// ── RevenueCat (App Store / Google Play) ──
export { PRODUCT_IDS, PRODUCTS, TIER_RANK, ENTITLEMENTS, OFFERING_ID, tierFromEntitlements } from './products';
export { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseIncognito, hasUnlimitedRewinds, canUseWhispers, canUseDiasporaConnect, isSubscribed, ALL_FEATURES_FREE } from './entitlements';
export { PAYMENTS_ENABLED, SHOW_PAYMENTS_UI, showPaymentsComingSoon } from './comingSoon';
export { default as PaymentService } from './PaymentService';
export { SubscriptionProvider, useSubscription, useSubscriptionState, useSubscriptionActions } from './SubscriptionContext';

// ── Stripe (primary global rail — cards, Apple Pay, Google Pay, Link) ──
export { default as StripeService } from './StripeService';

// ── Payment method picker constants ──
export { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, PAYMENT_METHOD_COLORS, getAvailableMethods } from './paymentMethods';
