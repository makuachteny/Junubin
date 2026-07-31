// CoinPurchaseSheet — RETIRED.
//
// JuNubin has no monetization. Coins/credits are no longer sold, and
// with the lean discovery + chat scope there is nothing left for them
// to buy, so the purchase sheet and its Stripe / Flutterwave / IAP
// wiring were deleted outright.
//
// The component itself is kept as an inert no-op — ChatScreen (owned
// by another agent) still imports and renders it, and this stub means
// that import keeps resolving and renders nothing at all. Delete this
// file once no screen references it.
//
// Props (`visible`, `onClose`) are accepted and ignored so existing
// call sites type-check and behave predictably.
export default function CoinPurchaseSheet() {
  return null;
}
