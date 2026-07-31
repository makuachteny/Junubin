// ── DEPRECATED / UNUSED: JUNUBIN IS FREE ──────────────────────────
// The app has no monetization. No client surface can start a Stripe
// Checkout session (`SHOW_PAYMENTS_UI` and `PAYMENTS_ENABLED` are
// permanently false), so stripe-create-checkout should never receive a
// productId in practice and this table should never grant anything new.
//
// It is kept — not deleted — because these Stripe products and prices
// are live and referenced by historical sessions, subscriptions and
// webhook events. Removing a row would break reconciliation of an
// already-completed payment (and, for any subscription still active on
// Stripe's side, its renewal webhook).
//
// Retired dating SKUs are marked below. Do not add rows, do not sell
// any of these, and do not re-point a UI at them.
//
// Server-side Stripe price ID mapping. The price IDs are populated by
// scripts/setup-stripe-products.js and committed via stripeProducts.generated.json
// — but Edge Functions can't import JSON cleanly, so we mirror the table here.
// Keep both files in sync: re-run the setup script and update this map if you
// regenerate Stripe products.

export type StripeProductRow = {
  stripeProductId: string;
  stripePriceId: string;
  amountCents: number;
  // Type drives downstream entitlement granting in the webhook.
  kind: 'subscription' | 'consumable';
  // For subscriptions: the internal tier the user lands on. For consumables:
  // category + quantity for credit-counter top-up.
  tier?: 'plus' | 'junub';
  category?: 'spotlight' | 'superlike' | 'coins';
  quantity?: number;
};

export const STRIPE_PRODUCTS: Record<string, StripeProductRow> = {
  // ── DEPRECATED: no plan is sold. Rows retained because any
  // subscription still active on Stripe keeps emitting renewal
  // webhooks that resolve through this map.
  'com.junubin.sub.plus.monthly': {
    stripeProductId: 'prod_USOdXTvacaP7ta',
    stripePriceId: 'price_1TTTqODZ3XofDR4HjvnJ3NSw',
    amountCents: 999,
    kind: 'subscription',
    tier: 'plus',
  },
  'com.junubin.sub.plus.6month': {
    stripeProductId: 'prod_USOdreqRkMwOS1',
    stripePriceId: 'price_1TTTqQDZ3XofDR4Hy7dpxti8',
    amountCents: 3999,
    kind: 'subscription',
    tier: 'plus',
  },
  'com.junubin.sub.junub.monthly': {
    stripeProductId: 'prod_USOdvr1RiCUNgT',
    stripePriceId: 'price_1TTTqRDZ3XofDR4HCRp86WAG',
    amountCents: 1999,
    kind: 'subscription',
    tier: 'junub',
  },
  'com.junubin.sub.junub.6month': {
    stripeProductId: 'prod_USOd7OQML8fJO5',
    stripePriceId: 'price_1TTTqSDZ3XofDR4HLyO8nQq3',
    amountCents: 7999,
    kind: 'subscription',
    tier: 'junub',
  },
  // ── DEPRECATED: paid profile boosts. Directory visibility is not
  // for sale in the free app; kept for historical lookup only.
  'com.junubin.spotlight.1': {
    stripeProductId: 'prod_USOd7bEihkTKWp',
    stripePriceId: 'price_1TTTqTDZ3XofDR4HXYKIxMeQ',
    amountCents: 599,
    kind: 'consumable',
    category: 'spotlight',
    quantity: 1,
  },
  'com.junubin.spotlight.5': {
    stripeProductId: 'prod_USOdFy3ylKSqre',
    stripePriceId: 'price_1TTTqUDZ3XofDR4Hv8KAW1rq',
    amountCents: 1999,
    kind: 'consumable',
    category: 'spotlight',
    quantity: 5,
  },
  'com.junubin.spotlight.10': {
    stripeProductId: 'prod_USOd59j7Id4JBI',
    stripePriceId: 'price_1TTTqVDZ3XofDR4HQz55SQhp',
    amountCents: 2999,
    kind: 'consumable',
    category: 'spotlight',
    quantity: 10,
  },
  // ── DEPRECATED: retired dating SKU. The app has no Super Likes.
  // Never sell these again; kept for historical lookup only.
  'com.junubin.superlike.5': {
    stripeProductId: 'prod_USOdrJlYyuRKwh',
    stripePriceId: 'price_1TTTqXDZ3XofDR4HLKwpldN7',
    amountCents: 799,
    kind: 'consumable',
    category: 'superlike',
    quantity: 5,
  },
  'com.junubin.superlike.15': {
    stripeProductId: 'prod_USOdKx9PyNV6LN',
    stripePriceId: 'price_1TTTqYDZ3XofDR4HeLELUGMp',
    amountCents: 1799,
    kind: 'consumable',
    category: 'superlike',
    quantity: 15,
  },
  'com.junubin.superlike.30': {
    stripeProductId: 'prod_USOdq7n2oz1vdt',
    stripePriceId: 'price_1TTTqZDZ3XofDR4HCzR80pUF',
    amountCents: 2999,
    kind: 'consumable',
    category: 'superlike',
    quantity: 30,
  },
  // ── DEPRECATED: credits are no longer sold and buy nothing.
  'com.junubin.coins.100': {
    stripeProductId: 'prod_USOdkqSzBRtdYd',
    stripePriceId: 'price_1TTTqbDZ3XofDR4HTEIm3rV6',
    amountCents: 199,
    kind: 'consumable',
    category: 'coins',
    quantity: 100,
  },
  'com.junubin.coins.500': {
    stripeProductId: 'prod_USOdkYaRd4NvuC',
    stripePriceId: 'price_1TTTqcDZ3XofDR4H2ndFTTCx',
    amountCents: 799,
    kind: 'consumable',
    category: 'coins',
    quantity: 500,
  },
  'com.junubin.coins.1200': {
    stripeProductId: 'prod_USOd9pzPoPGyM7',
    stripePriceId: 'price_1TTTqeDZ3XofDR4HEyOJSsxf',
    amountCents: 1499,
    kind: 'consumable',
    category: 'coins',
    quantity: 1200,
  },
};

// Reverse lookup for the webhook: Stripe price id → internal product id.
export const PRICE_ID_TO_JUNUBIN: Record<string, string> = Object.entries(STRIPE_PRODUCTS).reduce(
  (acc, [junubinId, row]) => {
    acc[row.stripePriceId] = junubinId;
    return acc;
  },
  {} as Record<string, string>,
);
