// ── RevenueCat (App Store / Google Play) ──
export { PRODUCT_IDS, PRODUCTS, TIER_RANK, ENTITLEMENTS, OFFERING_ID, tierFromEntitlements } from './products';
export { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseIncognito, hasUnlimitedRewinds, canUseWhispers, canUseDiasporaConnect, isSubscribed } from './entitlements';
export { default as PaymentService } from './PaymentService';
export { SubscriptionProvider, useSubscription, useSubscriptionState, useSubscriptionActions } from './SubscriptionContext';

// ── Flutterwave (M-Pesa, MoMo, Airtel, Bank, Card) ──
export { default as FlutterwaveService, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, PAYMENT_METHOD_ICONS, PAYMENT_METHOD_COLORS, getAvailableMethods } from './FlutterwaveService';

// ── African Localized Pricing ──
export { AFRICAN_PRICES, SUPPORTED_CURRENCIES, EVENT_TICKET_TIERS, getLocalizedPrice, formatAfricanPrice, detectCurrency } from './africanPricing';
