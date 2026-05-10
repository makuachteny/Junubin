-- 00023 — Stripe Connect onboarding state on User.
-- Lets creators receive payouts via Stripe Transfers. Onboarding goes
-- through Stripe's hosted Express form; we only persist the resulting
-- account id and a cached `chargesEnabled` flag so the UI can decide
-- whether the user is ready for transfers without round-tripping to
-- Stripe on every Profile render.
--
-- The `account.updated` webhook handler in stripe-webhook keeps the
-- two boolean flags in sync — chargesEnabled is currently advisory
-- (we only do transfers, not charges, on Connect accounts), but
-- mirroring both lets the operator dashboard surface why a payout
-- is failing without re-querying Stripe.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeConnectAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripeConnectChargesEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "stripeConnectPayoutsEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "User_stripe_connect_idx"
  ON "User" ("stripeConnectAccountId")
  WHERE "stripeConnectAccountId" IS NOT NULL;

-- ── PayoutRequest.metadata ──────────────────────────────────────────
-- Provider transaction ids (Stripe transferId, Flutterwave
-- transactionId), processing reference strings, and any error context
-- live in this jsonb blob so we have a complete audit trail without
-- adding a column per provider field. The flw-webhook handler keys
-- async settlement events off `metadata->>'transactionId'`.
ALTER TABLE "PayoutRequest"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

-- Index used by flw-webhook to look up a PayoutRequest by Flutterwave
-- transactionId on transfer.completed / transfer.failed events.
CREATE INDEX IF NOT EXISTS "PayoutRequest_flw_tx_idx"
  ON "PayoutRequest" (("metadata"->>'transactionId'))
  WHERE "metadata" ? 'transactionId';

-- ── admin_process_payout RPC ────────────────────────────────────────
-- Service-role-only state-transition gate. Flips a PayoutRequest from
-- 'pending' → 'processing' atomically so the Edge Function can claim a
-- row before calling Stripe / Flutterwave (preventing two concurrent
-- operator triggers from fulfilling the same request twice).
--
-- The actual provider transfer call lives in the process-payout Edge
-- Function — this RPC just owns the lock + status transition. Pattern
-- mirrors 00021's request_payout (SECURITY DEFINER, raise on bad
-- precondition). Only callable by the service_role; an authenticated
-- user calling this RPC raises immediately.
CREATE OR REPLACE FUNCTION public.admin_process_payout(request_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_status TEXT;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'admin_process_payout requires service_role';
  END IF;

  IF request_id IS NULL OR length(request_id) = 0 THEN
    RAISE EXCEPTION 'request_id required';
  END IF;

  -- Lock the row so two concurrent service-role triggers can't both
  -- transition the same request from pending → processing.
  SELECT "status"
    INTO row_status
    FROM "PayoutRequest"
    WHERE "id" = request_id
    FOR UPDATE;

  IF row_status IS NULL THEN
    RAISE EXCEPTION 'payout request not found: %', request_id;
  END IF;

  IF row_status <> 'pending' THEN
    RAISE EXCEPTION 'payout request is not pending: status=%', row_status;
  END IF;

  UPDATE "PayoutRequest"
     SET "status" = 'processing'
   WHERE "id" = request_id;

  RETURN jsonb_build_object('id', request_id, 'status', 'processing');
END;
$$;

-- service_role only. Don't grant to authenticated/anon.
REVOKE ALL ON FUNCTION public.admin_process_payout(TEXT) FROM PUBLIC;
