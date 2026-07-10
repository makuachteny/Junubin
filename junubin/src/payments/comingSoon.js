// Payments-enabled flag.
//
// Controls whether real money moves. When false, every purchase /
// payout attempt surfaces a friendly "Coming soon" alert and resolves
// to a no-op so the calling screen doesn't enter a half-completed
// state. When true, the corresponding rail (Stripe / App Store IAP)
// actually charges the user.
//
// v1 launch: enabled. Stripe is the primary global rail (web +
// Android); App Store IAP runs on iOS for Apple-policy compliance.
// Both are wired through the same SubscriptionContext — see
// `purchaseWithStripe` and `purchase` (RevenueCat).

import { Alert } from 'react-native';

export const PAYMENTS_ENABLED = true;

// UI-level gate. While this is false, every payment-related surface is
// hidden — the Elite tier sheet, the Boost spotlight purchase screen,
// the coin/super-like purchase sheets, "Manage Subscription", "Restore
// Purchases", etc. App Review rejects apps that show non-functional
// payment UI ("Subscribe" buttons that lead to a "Coming soon" alert),
// so the v1 build hides all of it.
//
// This is the cosmetic counterpart to PAYMENTS_ENABLED above:
//   PAYMENTS_ENABLED  — controls whether *transactions* succeed
//   SHOW_PAYMENTS_UI  — controls whether *buttons* appear at all
// Both are true for the monetized v1 launch: payment UI is visible AND
// transactions move real money. Before submitting, make sure the store
// IAP products + RevenueCat entitlements + Stripe webhook are all live
// (see docs/production-readiness-2026-05-27.md) — App Review tests a
// real purchase, and a Subscribe button with no working product behind
// it is a rejection.
export const SHOW_PAYMENTS_UI = true;

/**
 * Shows the "Coming soon" alert and returns a sentinel that purchase
 * call sites can short-circuit on. The shape mirrors what successful
 * `PaymentService.purchaseProduct` returns — `success: false` plus an
 * `error: 'payments_disabled'` discriminator — so existing handlers
 * that branch on `result.success` already do the right thing.
 */
export function showPaymentsComingSoon() {
  Alert.alert(
    'Coming soon',
    'Payments are launching soon on JuNubin. We\'ll let you know the moment it goes live.',
    [{ text: 'OK', style: 'cancel' }],
  );
  return { success: false, error: 'payments_disabled' };
}
