-- 00019 — Live + chat gift events (server-backed earnings ledger).
--
-- Today, gift coins accumulate in local React state during a live
-- stream and disappear when the stream ends. This migration introduces
-- a per-event ledger so every gift sent (live OR in-chat) is recorded
-- server-side and creators don't lose them on app reload / stream end.
--
-- Cash-out itself remains a "coming soon" alert — that's a separate
-- ticket. This migration only persists the data; payout routing
-- (Stripe Connect / Flutterwave) is not in scope.
--
-- Shape mirrors the counter-trigger pattern from 00017: an immutable
-- event row + a SECURITY DEFINER trigger that bumps a denormalised
-- running total on User. Profile screens read the running total
-- without paying for a sum query on every render.

-- ── 1. LiveGiftEvent ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LiveGiftEvent" (
  "id"          TEXT PRIMARY KEY,
  "hostUserId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "giverUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "giftType"    TEXT NOT NULL,
  "coinAmount"  INTEGER NOT NULL CHECK ("coinAmount" > 0),
  "context"     TEXT NOT NULL DEFAULT 'live'
    CHECK ("context" IN ('live', 'chat')),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "LiveGiftEvent_host_idx"
  ON "LiveGiftEvent" ("hostUserId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "LiveGiftEvent_giver_idx"
  ON "LiveGiftEvent" ("giverUserId", "createdAt" DESC);

ALTER TABLE "LiveGiftEvent" ENABLE ROW LEVEL SECURITY;

-- Either party of a gift event (host or giver) can read it. Everyone
-- else is locked out — third parties don't need to see who tipped whom.
CREATE POLICY "Gift event readable by host or giver"
  ON "LiveGiftEvent" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id IN ("LiveGiftEvent"."hostUserId", "LiveGiftEvent"."giverUserId")
    )
  );

-- Only the giver can record their own gift — prevents a host from
-- minting fake earnings against another user's account.
CREATE POLICY "Giver can insert own gift event"
  ON "LiveGiftEvent" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = "LiveGiftEvent"."giverUserId"
    )
  );

-- No UPDATE / DELETE policies. Ledger rows are immutable; corrections
-- happen via compensating entries (out of scope for this migration).

-- ── 2. Running total on User ─────────────────────────────────────────
-- Denormalised count so Profile + GoLive earnings sheet can render
-- "total coins received" without a sum query. Trigger below keeps it
-- in sync with the underlying LiveGiftEvent rows.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totalGiftCoinsReceived" INTEGER NOT NULL DEFAULT 0;

-- ── 3. Counter trigger ───────────────────────────────────────────────
-- Increment the host's running total when a gift event is inserted.
-- SECURITY DEFINER so the UPDATE bypasses the author-only User UPDATE
-- policy when a non-host (the giver) is the row author. Same shape as
-- _post_like_count_sync in 00017.
CREATE OR REPLACE FUNCTION public._live_gift_total_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "User"
       SET "totalGiftCoinsReceived" = "totalGiftCoinsReceived" + NEW."coinAmount"
     WHERE id = NEW."hostUserId";
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS live_gift_total_trg ON "LiveGiftEvent";
CREATE TRIGGER live_gift_total_trg
  AFTER INSERT ON "LiveGiftEvent"
  FOR EACH ROW EXECUTE FUNCTION public._live_gift_total_sync();
