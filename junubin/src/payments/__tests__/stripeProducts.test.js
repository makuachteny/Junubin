// Catches drift between products.js (source of USD prices) and the generated
// Stripe Price IDs in stripeProducts.generated.json. If you re-run the
// setup-stripe-products script, this test fails the moment the on-disk file
// stops matching the catalog — forcing the Edge Function mirror to be updated.

const fs = require('fs');
const path = require('path');
const { PRODUCTS, PRODUCT_IDS } = require('../products');

let GENERATED;
try {
  GENERATED = require('../stripeProducts.generated.json');
} catch {
  GENERATED = null;
}

function dollarsToCents(usdString) {
  const n = Number(usdString.replace(/[^0-9.]/g, ''));
  return Math.round(n * 100);
}

describe('Stripe product catalog', () => {
  test('every internal product has a Stripe entry generated', () => {
    if (!GENERATED) {
      // Skip when the bootstrap script hasn't been run yet — CI environments
      // without Stripe keys shouldn't fail. The presence check still runs in
      // dev once the developer ran `node scripts/setup-stripe-products.js`.
      return;
    }
    for (const id of Object.values(PRODUCT_IDS)) {
      expect(GENERATED[id]).toBeDefined();
      expect(GENERATED[id].stripePriceId).toMatch(/^price_/);
      expect(GENERATED[id].stripeProductId).toMatch(/^prod_/);
    }
  });

  test('Stripe amountCents matches USD price in products.js', () => {
    if (!GENERATED) return;
    for (const [id, product] of Object.entries(PRODUCTS)) {
      const stripe = GENERATED[id];
      if (!stripe) continue;
      expect(stripe.amountCents).toBe(dollarsToCents(product.price));
    }
  });
});
