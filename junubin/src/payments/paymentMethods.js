/**
 * Payment method identifiers + UI metadata.
 *
 * Three rails:
 *  - **Stripe**: primary global rail on Android + web. Dynamic payment
 *    methods — cards, Apple Pay, Google Pay, Link, plus every local
 *    method enabled in the Stripe dashboard — worldwide.
 *  - **App Store IAP** (via RevenueCat): the only rail Apple permits for
 *    digital goods on iOS; on Android it's a secondary option.
 *  - **Mobile Money** (via Flutterwave): M-Pesa, MTN MoMo, Airtel Money
 *    for East/Central Africa. DORMANT until the operator sets
 *    EXPO_PUBLIC_FLUTTERWAVE_ENABLED=true in the build env (and the
 *    server-side FLUTTERWAVE_SECRET_KEY secret) — the option simply
 *    doesn't render until both halves are configured.
 */

export const PAYMENT_METHODS = {
  STRIPE: 'stripe',
  APP_STORE: 'app_store',
  MOBILE_MONEY: 'mobile_money',
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.STRIPE]: 'Card or Wallet',
  [PAYMENT_METHODS.APP_STORE]: 'App Store',
  [PAYMENT_METHODS.MOBILE_MONEY]: 'Mobile Money',
};

export const PAYMENT_METHOD_ICONS = {
  [PAYMENT_METHODS.STRIPE]: 'card',
  [PAYMENT_METHODS.APP_STORE]: 'logo-apple',
  [PAYMENT_METHODS.MOBILE_MONEY]: 'phone-portrait',
};

export const PAYMENT_METHOD_COLORS = {
  [PAYMENT_METHODS.STRIPE]: '#635BFF',
  [PAYMENT_METHODS.APP_STORE]: '#000000',
  [PAYMENT_METHODS.MOBILE_MONEY]: '#4CAF50',
};

// Countries where the Flutterwave mobile-money rail can collect.
// Source: Flutterwave mobile-money coverage (M-Pesa: KE/TZ; MTN MoMo:
// UG/RW/ZM/CM/CI/GH; Airtel: KE/UG/TZ/RW).
// https://developer.flutterwave.com/docs/mobile-money
export const MOBILE_MONEY_COUNTRIES = ['KE', 'UG', 'TZ', 'RW', 'GH', 'ZM', 'CM', 'CI'];

// Operator kill-switch for the mobile-money rail. Ships OFF; flip to
// 'true' in eas.json env once the Flutterwave account is live and the
// FLUTTERWAVE_SECRET_KEY secret is set server-side.
export const MOBILE_MONEY_ENABLED =
  String(process.env.EXPO_PUBLIC_FLUTTERWAVE_ENABLED || '').toLowerCase() === 'true';

/**
 * Get available payment methods for in-app digital purchases.
 *
 * Policy split:
 *  - **iOS**: Apple's App Store Review Guidelines (§3.1.1) require IAP
 *    for digital subscriptions and consumables in native iOS apps, so
 *    we surface ONLY App Store IAP (RevenueCat). No Stripe, no mobile
 *    money — Apple rejects alternative rails for digital goods.
 *  - **Android + web**: Stripe is the primary rail. Play IAP is a
 *    secondary option on Android. Mobile Money (Flutterwave) appears
 *    only when the rail is enabled AND the user's country supports it.
 *
 * @param {string} countryCode - ISO country code (e.g. 'KE', 'UG', 'US')
 * @param {string} platform - 'ios' | 'android' | 'web'
 * @returns {string[]}
 */
export function getAvailableMethods(countryCode, platform) {
  if (platform === 'ios') {
    return [PAYMENT_METHODS.APP_STORE];
  }

  const methods = [PAYMENT_METHODS.STRIPE];
  if (MOBILE_MONEY_ENABLED && MOBILE_MONEY_COUNTRIES.includes(countryCode)) {
    methods.push(PAYMENT_METHODS.MOBILE_MONEY);
  }
  if (platform === 'android') {
    methods.push(PAYMENT_METHODS.APP_STORE);
  }
  return methods;
}
