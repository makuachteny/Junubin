// Payments-coming-soon flag.
//
// For the v1 TestFlight launch we ship without live payment processing —
// the infrastructure (RevenueCat, Stripe, Flutterwave, payouts) is wired
// and deployed but we don't want users transacting against a path we
// haven't manually QA'd in a sandbox tester yet. When `PAYMENTS_ENABLED`
// is false, every purchase / payout attempt surfaces a friendly
// "Coming soon" alert and resolves to a no-op so the calling screen
// doesn't enter a half-completed state.
//
// Flip the flag to true once the App Store / Google Play products are
// approved AND the Stripe + Flutterwave dashboard webhooks are pointed
// at the production functions AND we've watched a sandbox transaction
// land successfully. There's no other code path to update.

import { Alert } from 'react-native';

export const PAYMENTS_ENABLED = false;

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
// Flip both true together when monetization launches.
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
