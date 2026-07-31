/**
 * Server-side Flutterwave product pricing.
 *
 * ── DEPRECATED / UNUSED: JUNUBIN IS FREE ──────────────────────────
 * The app has no monetization. Nothing is sold, no client surface can
 * start a Flutterwave checkout, and `PAYMENTS_ENABLED` is permanently
 * false, so no new payment should ever be priced from this table.
 *
 * It is kept — not deleted — because the product identifiers below are
 * live on the Flutterwave side and referenced by historical
 * transactions. Deleting rows would make an already-recorded payment
 * unresolvable if it ever needs reconciling or refunding.
 *
 * Do not add rows. Do not wire this to a new purchase flow. The
 * super-like rows in particular are a retired dating mechanic, kept
 * only for receipt lookup.
 *
 * This was the authoritative pricing source; the client-side table in
 * africanPricing.js has been emptied.
 */

export const FLW_PRODUCT_PRICES: Record<string, Record<string, number>> = {
  // ── Subscriptions ──
  "com.junubin.sub.plus.monthly": {
    KES: 1500, UGX: 37000, TZS: 25000, SSP: 13000,
    RWF: 12000, XAF: 6000, GHS: 150, NGN: 15000,
    USD: 9.99, GBP: 7.99, EUR: 8.99, CAD: 12.99, AUD: 14.99,
  },
  "com.junubin.sub.plus.6month": {
    KES: 6000, UGX: 148000, TZS: 100000, SSP: 52000,
    RWF: 48000, XAF: 24000, GHS: 600, NGN: 60000,
    USD: 39.99, GBP: 31.99, EUR: 35.99, CAD: 49.99, AUD: 59.99,
  },
  "com.junubin.sub.junub.monthly": {
    KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000,
    RWF: 24000, XAF: 12000, GHS: 300, NGN: 30000,
    USD: 19.99, GBP: 15.99, EUR: 17.99, CAD: 25.99, AUD: 29.99,
  },
  "com.junubin.sub.junub.6month": {
    KES: 12000, UGX: 296000, TZS: 200000, SSP: 104000,
    RWF: 96000, XAF: 48000, GHS: 1200, NGN: 120000,
    USD: 79.99, GBP: 63.99, EUR: 71.99, CAD: 99.99, AUD: 119.99,
  },

  // ── Consumables — Spotlights (DEPRECATED) ──
  // Paid profile boosts. Removed from the app: directory visibility is
  // not for sale. Rows kept for historical transaction lookup only.
  "com.junubin.spotlight.1": {
    KES: 900, UGX: 22000, TZS: 15000, SSP: 7800,
    RWF: 7200, XAF: 3600, GHS: 90, NGN: 9000, USD: 5.99,
  },
  "com.junubin.spotlight.5": {
    KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000,
    RWF: 24000, XAF: 12000, GHS: 300, NGN: 30000, USD: 19.99,
  },
  "com.junubin.spotlight.10": {
    KES: 4500, UGX: 111000, TZS: 75000, SSP: 39000,
    RWF: 36000, XAF: 18000, GHS: 450, NGN: 45000, USD: 29.99,
  },

  // ── Consumables — Super Likes (DEPRECATED, retired dating SKU) ──
  // Never sell these again. Kept solely so an existing purchase can
  // still be resolved to a product; the app no longer has Super Likes.
  "com.junubin.superlike.5": {
    KES: 1200, UGX: 30000, TZS: 20000, SSP: 10400,
    RWF: 9600, XAF: 4800, GHS: 120, NGN: 12000, USD: 7.99,
  },
  "com.junubin.superlike.15": {
    KES: 2700, UGX: 67000, TZS: 45000, SSP: 23400,
    RWF: 21600, XAF: 10800, GHS: 270, NGN: 27000, USD: 17.99,
  },
  "com.junubin.superlike.30": {
    KES: 4500, UGX: 111000, TZS: 75000, SSP: 39000,
    RWF: 36000, XAF: 18000, GHS: 450, NGN: 45000, USD: 29.99,
  },

  // ── Consumables — Coins (DEPRECATED) ──
  // Credits are no longer sold and no longer buy anything.
  // Historically anchored on the USD prices in src/payments/products.js
  // (that client-side table has since been removed), using the
  // same local-currency ratios as the packs above. Added in the 2026-07
  // rail restore: the original catalog predated coins, so a coins
  // purchase via mobile money failed with "No pricing found".
  "com.junubin.coins.100": {
    KES: 300, UGX: 7400, TZS: 5000, SSP: 2600,
    RWF: 2400, XAF: 1200, GHS: 30, NGN: 3000, USD: 1.99,
  },
  "com.junubin.coins.500": {
    KES: 1200, UGX: 30000, TZS: 20000, SSP: 10400,
    RWF: 9600, XAF: 4800, GHS: 120, NGN: 12000, USD: 7.99,
  },
  "com.junubin.coins.1200": {
    KES: 2250, UGX: 55500, TZS: 37500, SSP: 19500,
    RWF: 18000, XAF: 9000, GHS: 225, NGN: 22500, USD: 14.99,
  },
};

/**
 * Event ticket pricing tiers — DEPRECATED. Events are out of scope for
 * the lean discovery + chat product and no client surface can create a
 * ticket purchase. Kept for historical transaction lookup only.
 */
export const EVENT_TICKET_TIERS: Record<string, Record<string, number>> = {
  basic: { KES: 500, UGX: 12000, TZS: 8000, SSP: 4000, USD: 5 },
  standard: { KES: 1500, UGX: 37000, TZS: 25000, SSP: 13000, USD: 10 },
  premium: { KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000, USD: 25 },
  vip: { KES: 5000, UGX: 120000, TZS: 80000, SSP: 40000, USD: 50 },
};

/**
 * Look up the server-authoritative price for a product.
 * For event tickets, productId starts with "event_ticket_" and ticketTier is in eventMeta.
 */
export function getServerPrice(
  productId: string,
  currency: string,
  eventMeta?: { ticketTier?: string }
): number | null {
  // Event ticket
  if (productId.startsWith("event_ticket_") && eventMeta?.ticketTier) {
    return EVENT_TICKET_TIERS[eventMeta.ticketTier]?.[currency] ?? null;
  }
  // Regular product
  return FLW_PRODUCT_PRICES[productId]?.[currency] ?? null;
}
