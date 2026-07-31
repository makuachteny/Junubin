// Payments flags.
//
// ── JUNUBIN IS FREE. THIS IS PERMANENT, NOT A LAUNCH TOGGLE. ──────
// JuNubin has no monetization. There is no paid tier, no consumable,
// no upgrade prompt and no planned date on which any of this turns
// on. Both flags below are permanently false; treat a PR that flips
// either one as a product change, not a config tweak.

import { Alert } from 'react-native';

// Controls whether *transactions* are attempted at all. Permanently
// false — the app never charges anyone. The real-money rails (Stripe,
// RevenueCat, Flutterwave) stay wired but dormant so nothing already
// live server-side breaks.
export const PAYMENTS_ENABLED = false;

// Controls whether payment *buttons* appear anywhere. Permanently
// false: there is no subscription sheet, no boost purchase screen and
// no credit sheet left to show. App Review rejects apps that display
// non-functional payment UI, and beyond that, a free app that still
// advertises tiers is simply lying to its users.
//
//   PAYMENTS_ENABLED  — controls whether *transactions* succeed
//   SHOW_PAYMENTS_UI  — controls whether *buttons* appear at all
export const SHOW_PAYMENTS_UI = false;

/**
 * Backstop for any purchase call site that survives the free-app
 * cleanup. It should be unreachable — no screen offers a purchase —
 * but if one is ever reached it tells the truth (the app is free)
 * rather than promising a future paid feature.
 *
 * Returns a sentinel that mirrors what `PaymentService.purchaseProduct`
 * returns on failure — `success: false` plus an
 * `error: 'payments_disabled'` discriminator — so existing handlers
 * that branch on `result.success` already do the right thing.
 */
export function showPaymentsComingSoon() {
  Alert.alert(
    'JuNubin is free',
    'Every feature is included at no cost. There is nothing to buy.',
    [{ text: 'OK', style: 'cancel' }],
  );
  return { success: false, error: 'payments_disabled' };
}
