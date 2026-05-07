#!/usr/bin/env node
// Idempotently create JuNubin's Stripe products + prices.
// Usage: STRIPE_SECRET_KEY=sk_test_... node scripts/setup-stripe-products.js
//
// Tagged via metadata.junubin_product_id so re-runs reuse existing products
// instead of duplicating them. Outputs the resulting price IDs to stdout
// and writes them to src/payments/stripeProducts.generated.json so the
// runtime can map internal product IDs → Stripe price IDs.

const fs = require('fs');
const path = require('path');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY env var.');
  process.exit(1);
}

const STRIPE_API = 'https://api.stripe.com/v1';

// USD prices in cents — must match src/payments/products.js.
const CATALOG = [
  { id: 'com.junubin.sub.plus.monthly',  name: 'JuNubin+ Monthly',     amount: 999,   recurring: { interval: 'month' } },
  { id: 'com.junubin.sub.plus.6month',   name: 'JuNubin+ 6 Months',    amount: 3999,  recurring: { interval: 'month', interval_count: 6 } },
  { id: 'com.junubin.sub.junub.monthly', name: 'Junub Monthly',        amount: 1999,  recurring: { interval: 'month' } },
  { id: 'com.junubin.sub.junub.6month',  name: 'Junub 6 Months',       amount: 7999,  recurring: { interval: 'month', interval_count: 6 } },
  { id: 'com.junubin.spotlight.1',       name: '1 Spotlight',          amount: 599 },
  { id: 'com.junubin.spotlight.5',       name: '5 Spotlights',         amount: 1999 },
  { id: 'com.junubin.spotlight.10',      name: '10 Spotlights',        amount: 2999 },
  { id: 'com.junubin.superlike.5',       name: '5 Super Likes',        amount: 799 },
  { id: 'com.junubin.superlike.15',      name: '15 Super Likes',       amount: 1799 },
  { id: 'com.junubin.superlike.30',      name: '30 Super Likes',       amount: 2999 },
  { id: 'com.junubin.coins.100',         name: '100 Coins',            amount: 199 },
  { id: 'com.junubin.coins.500',         name: '500 Coins',            amount: 799 },
  { id: 'com.junubin.coins.1200',        name: '1200 Coins',           amount: 1499 },
];

function form(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') {
      out.push(form(v, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out.join('&');
}

async function stripe(method, pathname, body) {
  const res = await fetch(`${STRIPE_API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20',
    },
    body: body ? form(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${pathname} failed: ${JSON.stringify(json.error || json)}`);
  }
  return json;
}

async function findExistingProduct(junubinId) {
  // Stripe doesn't index metadata for direct querying; list active products
  // and filter. Twelve products fits in a single page.
  const res = await stripe('GET', `/products?active=true&limit=100`);
  return (res.data || []).find((p) => p.metadata?.junubin_product_id === junubinId) || null;
}

async function findExistingPrice(productId, junubinId, recurringSig) {
  const res = await stripe('GET', `/prices?product=${productId}&active=true&limit=100`);
  return (res.data || []).find((p) => {
    if (p.metadata?.junubin_product_id !== junubinId) return false;
    if (recurringSig) {
      if (!p.recurring) return false;
      return (
        p.recurring.interval === recurringSig.interval &&
        (p.recurring.interval_count || 1) === (recurringSig.interval_count || 1)
      );
    }
    return p.recurring === null || p.recurring === undefined;
  }) || null;
}

async function ensure(item) {
  let product = await findExistingProduct(item.id);
  if (product) {
    process.stdout.write(`  ↻ product ${item.id} exists (${product.id})\n`);
  } else {
    product = await stripe('POST', '/products', {
      name: item.name,
      metadata: { junubin_product_id: item.id },
      tax_code: 'txcd_10000000', // SaaS — adjust later if needed
    });
    process.stdout.write(`  + product ${item.id} created (${product.id})\n`);
  }

  let price = await findExistingPrice(product.id, item.id, item.recurring);
  if (price) {
    process.stdout.write(`  ↻ price ${item.id} exists (${price.id}, ${price.unit_amount}¢)\n`);
  } else {
    const body = {
      product: product.id,
      currency: 'usd',
      unit_amount: item.amount,
      tax_behavior: 'exclusive',
      metadata: { junubin_product_id: item.id },
    };
    if (item.recurring) body.recurring = item.recurring;
    price = await stripe('POST', '/prices', body);
    process.stdout.write(`  + price ${item.id} created (${price.id}, ${price.unit_amount}¢)\n`);
  }

  return { junubinId: item.id, productId: product.id, priceId: price.id, amount: price.unit_amount };
}

async function main() {
  const results = {};
  for (const item of CATALOG) {
    const r = await ensure(item);
    results[r.junubinId] = { stripeProductId: r.productId, stripePriceId: r.priceId, amountCents: r.amount };
  }

  const outPath = path.join(__dirname, '..', 'src', 'payments', 'stripeProducts.generated.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
  process.stdout.write(`\nWrote ${Object.keys(results).length} entries to ${outPath}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
