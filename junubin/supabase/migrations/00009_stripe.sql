-- Stripe — web payment rail
--
-- Adds `stripeCustomerId` to User so a single Stripe customer maps to a
-- JuNubin account across sessions, and creates a `Payment` table that both
-- Stripe (and, retroactively, Flutterwave) can write to. Webhooks insert
-- one row per checkout session; entitlements are granted in the same txn.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS "User_stripeCustomerId_idx"
  ON "User" ("stripeCustomerId")
  WHERE "stripeCustomerId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"                  TEXT PRIMARY KEY,
  "userId"              TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "provider"            TEXT NOT NULL CHECK ("provider" IN ('stripe', 'flutterwave', 'apple', 'google')),
  -- Stripe: checkout session id (cs_…) or payment intent (pi_…). Flutterwave: tx_ref.
  "providerRef"         TEXT NOT NULL,
  "providerCustomerId"  TEXT,
  "junubinProductId"     TEXT NOT NULL,
  "amountCents"         INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'USD',
  "status"              TEXT NOT NULL CHECK ("status" IN (
    'pending', 'succeeded', 'failed', 'refunded', 'cancelled'
  )),
  -- For subscriptions, the Stripe subscription id (sub_…) so renewal/cancel
  -- webhooks can locate the row.
  "subscriptionId"      TEXT,
  "metadata"            JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("provider", "providerRef")
);

CREATE INDEX IF NOT EXISTS "Payment_userId_createdAt_idx"
  ON "Payment" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_idx"
  ON "Payment" ("subscriptionId")
  WHERE "subscriptionId" IS NOT NULL;

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

-- Users can read their own payment receipts. Webhooks (service_role) bypass RLS.
CREATE POLICY "Users can read own payments"
  ON "Payment" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Payment"."userId"
    )
  );

-- No client-side INSERT/UPDATE/DELETE policies — only the service_role key
-- (used by Edge Functions) may write rows. This is enforced by the absence of
-- INSERT/UPDATE/DELETE policies under RLS.
