/**
 * Payment method identifiers + UI metadata.
 *
 * Two rails remain:
 *  - **Stripe**: primary global rail on Android + web. Cards, Apple Pay,
 *    Google Pay, Link — worldwide.
 *  - **App Store IAP** (via RevenueCat): the only rail Apple permits for
 *    digital goods on iOS; on Android it's a secondary option.
 */

export const PAYMENT_METHODS = {
  STRIPE: 'stripe',
  APP_STORE: 'app_store',
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.STRIPE]: 'Card or Wallet',
  [PAYMENT_METHODS.APP_STORE]: 'App Store',
};

export const PAYMENT_METHOD_ICONS = {
  [PAYMENT_METHODS.STRIPE]: 'card',
  [PAYMENT_METHODS.APP_STORE]: 'logo-apple',
};

export const PAYMENT_METHOD_COLORS = {
  [PAYMENT_METHODS.STRIPE]: '#635BFF',
  [PAYMENT_METHODS.APP_STORE]: '#000000',
};

/**
 * Get available payment methods for in-app digital purchases.
 *
 * Policy split:
 *  - **iOS**: Apple's App Store Review Guidelines (§3.1.1) require IAP
 *    for digital subscriptions and consumables in native iOS apps, so
 *    we surface ONLY App Store IAP (RevenueCat).
 *  - **Android + web**: Stripe is the primary rail (cards, Apple Pay,
 *    Google Pay, Link). Play Store IAP via RevenueCat is available as
 *    a secondary option on Android for users who prefer it.
 *
 * @param {string} _countryCode - retained for API compatibility, unused now.
 * @param {string} platform - 'ios' | 'android' | 'web'
 * @returns {string[]}
 */
export function getAvailableMethods(_countryCode, platform) {
  if (platform === 'ios') {
    return [PAYMENT_METHODS.APP_STORE];
  }

  const methods = [PAYMENT_METHODS.STRIPE];
  if (platform === 'android') {
    methods.push(PAYMENT_METHODS.APP_STORE);
  }
  return methods;
}
