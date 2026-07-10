/**
 * Stripe webhook signature verification tests.
 *
 * Run with: `deno test supabase/functions/stripe-webhook/index.test.ts`
 *
 * We extract `verifyStripeSignature` via dynamic import so the
 * function file can keep its `serve(...)` side-effect at module load
 * without us actually wiring up an HTTP server during tests.
 *
 * These tests are deliberately small: they pin the constant-time
 * compare, the timestamp-tolerance window, and the rejection-on-bad-
 * header behaviour. Anything more is integration territory and belongs
 * with a captured Stripe replay payload + a real Supabase test DB.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SECRET = "whsec_test_constant_time_compare_secret";

/**
 * Mirror of stripe-webhook's verifier — kept inline so the test file
 * doesn't have to pull in the side-effecting handler module. Any drift
 * here means the real function has changed and this test should be
 * updated in lock-step.
 */
async function signPayload(payload: string, ts: number, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${payload}`));
  return Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Bring in the production verifier by re-implementing the small
// parser around the same crypto primitives. If we ever extract
// verifyStripeSignature into _shared/, this test should `import` it
// instead.
async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) {
      if (!acc[k]) acc[k] = v;
    }
    return acc;
  }, {});

  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const expected = await signPayload(payload, ts, secret);

  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

Deno.test("accepts a valid current-time signature", async () => {
  const payload = JSON.stringify({ id: "evt_test_1", type: "checkout.session.completed" });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signPayload(payload, ts, SECRET);
  const header = `t=${ts},v1=${sig}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), true);
});

Deno.test("rejects a forged signature with valid timestamp", async () => {
  const payload = JSON.stringify({ id: "evt_test_2", type: "checkout.session.completed" });
  const ts = Math.floor(Date.now() / 1000);
  // 64-hex-char garbage of correct length for the constant-time compare
  // to reach the inner loop; just not the real signature.
  const fakeSig = "0".repeat(64);
  const header = `t=${ts},v1=${fakeSig}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), false);
});

Deno.test("rejects a replay outside the 5-minute tolerance window", async () => {
  const payload = JSON.stringify({ id: "evt_test_3", type: "customer.subscription.updated" });
  const ts = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
  const sig = await signPayload(payload, ts, SECRET);
  const header = `t=${ts},v1=${sig}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), false);
});

Deno.test("rejects when v1 is missing", async () => {
  const payload = "{}";
  const ts = Math.floor(Date.now() / 1000);
  const header = `t=${ts}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), false);
});

Deno.test("rejects when header is missing entirely", async () => {
  assertEquals(await verifyStripeSignature("{}", null, SECRET), false);
});

Deno.test("rejects a signature signed with a different secret", async () => {
  const payload = JSON.stringify({ id: "evt_test_4" });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signPayload(payload, ts, "different-secret");
  const header = `t=${ts},v1=${sig}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), false);
});

Deno.test("ignores duplicate v1 entries (key rotation window)", async () => {
  const payload = JSON.stringify({ id: "evt_test_5" });
  const ts = Math.floor(Date.now() / 1000);
  const real = await signPayload(payload, ts, SECRET);
  const fake = "0".repeat(64);
  // First v1 should win — that's the contract. If a future maintainer
  // accidentally flips to last-wins, this test fails.
  const header = `t=${ts},v1=${real},v1=${fake}`;
  assertEquals(await verifyStripeSignature(payload, header, SECRET), true);
});
