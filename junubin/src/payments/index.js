// JuNubin payments barrel.
//
// The app is FREE — nothing here sells anything. The rails below stay
// wired but dormant (`PAYMENTS_ENABLED` / `SHOW_PAYMENTS_UI` are
// permanently false), and the entitlement helpers are shims that
// return `true` for everyone. Every symbol stays exported so that
// screens importing them keep working; see entitlements.js for which
// helpers are deprecated and awaiting deletion.

// ── RevenueCat (App Store / Google Play) ──
export { PRODUCT_IDS, PRODUCTS, TIER_RANK, ENTITLEMENTS, OFFERING_ID, RETIRED_PRODUCT_IDS, tierFromEntitlements } from './products';
export { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseIncognito, hasUnlimitedRewinds, canUseWhispers, canUseDiasporaConnect, isSubscribed, ALL_FEATURES_FREE } from './entitlements';
export { PAYMENTS_ENABLED, SHOW_PAYMENTS_UI, showPaymentsComingSoon } from './comingSoon';
export { default as PaymentService } from './PaymentService';
export { SubscriptionProvider, useSubscription, useSubscriptionState, useSubscriptionActions } from './SubscriptionContext';

// ── Stripe (primary global rail — cards, Apple Pay, Google Pay, Link) ──
export { default as StripeService } from './StripeService';

// ── Flutterwave (mobile money — M-Pesa, MTN MoMo, Airtel; East/Central Africa) ──
// Dormant until EXPO_PUBLIC_FLUTTERWAVE_ENABLED=true + FLUTTERWAVE_SECRET_KEY.
export { default as FlutterwaveService } from './FlutterwaveService';

// ── Payment method picker constants ──
export { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, PAYMENT_METHOD_COLORS, getAvailableMethods } from './paymentMethods';
