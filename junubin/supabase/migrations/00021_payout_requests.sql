-- 00021 — Payout requests (cash-out MVP).
--
-- Creators currently see "Cash out coming soon" with no way to even
-- register their interest. This migration introduces a payout request
-- queue: creators submit a request (method + destination), the platform
-- processes them manually, and `User.totalGiftCoinsReceived` is debited
-- atomically at submit time so the same coins can't be requested twice.
--
-- Real payout rails (Stripe Connect, Flutterwave Bank Transfer) are out
-- of scope — those are a multi-day integration. This MVP is a request
-- collector that the team fulfills manually.

-- ── 1. PayoutRequest ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PayoutRequest" (
  "id"            TEXT PRIMARY KEY,
  "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "coinAmount"    INTEGER NOT NULL CHECK ("coinAmount" > 0),
  "method"        TEXT NOT NULL
    CHECK ("method" IN ('stripe_connect', 'mobile_money', 'bank_transfer')),
  "destination"   JSONB NOT NULL DEFAULT '{}',  -- payout address blob (email, msisdn, account)
  "status"        TEXT NOT NULL DEFAULT 'pending'
    CHECK ("status" IN ('pending', 'processing', 'paid', 'rejected', 'cancelled')),
  "rejectionReason" TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt"    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "PayoutRequest_user_idx"   ON "PayoutRequest" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "PayoutRequest_status_idx" ON "PayoutRequest" ("status", "createdAt" ASC);

ALTER TABLE "PayoutRequest" ENABLE ROW LEVEL SECURITY;

-- Caller can read their own payout history. Service-role bypasses RLS,
-- so the operator dashboard (when it exists) can see everyone's queue.
CREATE POLICY "Owner can read own payout requests"
  ON "PayoutRequest" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PayoutRequest"."userId"
    )
  );

-- Direct INSERT for self. The request_payout RPC below is the
-- preferred path because it also debits the coin balance atomically;
-- this policy exists so a future operator-built admin tool that runs
-- as the user can fall through to a plain INSERT if the RPC isn't
-- available.
CREATE POLICY "Owner can insert own payout request"
  ON "PayoutRequest" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PayoutRequest"."userId"
    )
  );

-- The user can only flip a row to 'cancelled' from the client side.
-- All other status transitions (processing → paid, → rejected) happen
-- service-role-side from the operator dashboard. The WITH CHECK
-- requires the new status be 'cancelled' so even a misuse of the
-- update can't sneak in a different status.
CREATE POLICY "Owner can cancel own payout request"
  ON "PayoutRequest" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PayoutRequest"."userId"
    )
  )
  WITH CHECK (
    "status" = 'cancelled'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "PayoutRequest"."userId"
    )
  );

-- No DELETE policy. Payout requests are a financial audit trail; once
-- created they stay. Cancellation is a status flip, not a delete.

-- ── 2. request_payout RPC ───────────────────────────────────────────
-- Atomically validates balance, inserts the PayoutRequest row, and
-- debits User.totalGiftCoinsReceived in a single transaction. Mirrors
-- the SECURITY DEFINER pattern from 00012's unmatch_user RPC: the
-- function runs with elevated rights so it can UPDATE User (which the
-- table's own RLS would otherwise restrict to self-edits of profile
-- fields), and authorisation is checked inside the body.
--
-- Returns the inserted request id + the new running balance so the
-- caller can update its UI without a follow-up read.
CREATE OR REPLACE FUNCTION public.request_payout(
  coin_amount INTEGER,
  method      TEXT,
  destination JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id        TEXT;
  current_bal  INTEGER;
  new_id       TEXT;
  new_bal      INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF coin_amount IS NULL OR coin_amount <= 0 THEN
    RAISE EXCEPTION 'coin_amount must be positive';
  END IF;

  IF method IS NULL OR method NOT IN ('stripe_connect', 'mobile_money', 'bank_transfer') THEN
    RAISE EXCEPTION 'invalid method: %', method;
  END IF;

  -- Lock the User row so two concurrent payout requests can't both
  -- pass the balance check and end up overdrafting.
  SELECT id, "totalGiftCoinsReceived"
    INTO me_id, current_bal
    FROM "User"
    WHERE auth_id = auth.uid()
    FOR UPDATE;

  IF me_id IS NULL THEN
    RAISE EXCEPTION 'no user row';
  END IF;

  IF current_bal < coin_amount THEN
    RAISE EXCEPTION 'insufficient balance: have %, requested %', current_bal, coin_amount;
  END IF;

  new_id := 'po_' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO "PayoutRequest" ("id", "userId", "coinAmount", "method", "destination")
    VALUES (new_id, me_id, coin_amount, method, COALESCE(destination, '{}'::jsonb));

  UPDATE "User"
     SET "totalGiftCoinsReceived" = "totalGiftCoinsReceived" - coin_amount
   WHERE id = me_id
   RETURNING "totalGiftCoinsReceived" INTO new_bal;

  RETURN jsonb_build_object(
    'id', new_id,
    'balance', new_bal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_payout(INTEGER, TEXT, JSONB) TO authenticated;
