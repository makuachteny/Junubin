-- ════════════════════════════════════════════════════════════════
-- Photo moderation verdicts
--
-- Profile photos were being scanned and then ignored. `moderate-image`
-- only ever wrote its verdict back for Posts (00014 gave Post the
-- moderationStatus / moderationVerdict / moderationCheckedAt trio);
-- for a `kind: 'photo'` call the result was returned to a caller that
-- had already fired-and-forgotten it. So the highest-stakes media on
-- the platform — the first impression every profile makes — was
-- scanned into a void.
--
-- This adds the same trio to Photo so a verdict has somewhere to land.
--
-- ── Display rule ────────────────────────────────────────────────
-- Read paths hide 'rejected' ONLY. 'pending' and 'flagged' stay
-- visible on purpose:
--   * 'pending' is the state of every photo between upload and the
--     provider answering. Hiding it would mean a new upload vanishes
--     for seconds — or forever, if MODERATION_PROVIDER is unset and
--     the function 503s. A moderation outage must not become an
--     "all photos disappeared" outage.
--   * 'flagged' is the soft-label band (provider confidence above the
--     flag threshold but below reject). It is a human-review queue,
--     not a verdict. Post treats it the same way.
--
-- ── Backfill ────────────────────────────────────────────────────
-- Existing rows become 'approved', not 'pending'. They predate this
-- column and were never scanned; marking them 'pending' would be
-- honest but would put every historical photo in a review queue that
-- has no reviewer yet, and 'pending' is displayed anyway — so the
-- distinction would be cosmetic while making the queue useless.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE public."Photo"
  ADD COLUMN IF NOT EXISTS "moderationStatus" TEXT NOT NULL DEFAULT 'pending'
    CHECK ("moderationStatus" IN ('pending', 'approved', 'flagged', 'rejected')),
  ADD COLUMN IF NOT EXISTS "moderationVerdict"  JSONB,
  ADD COLUMN IF NOT EXISTS "moderationCheckedAt" TIMESTAMPTZ;

COMMENT ON COLUMN public."Photo"."moderationStatus" IS
  'pending | approved | flagged | rejected. Written by the moderate-image Edge Function. Read paths hide rejected only; pending and flagged remain visible so a moderation outage never blanks the app.';

-- Backfill: everything that existed before this column was never
-- scanned. See the note above on why these become approved.
UPDATE public."Photo"
   SET "moderationStatus" = 'approved'
 WHERE "moderationCheckedAt" IS NULL
   AND "moderationStatus" = 'pending';

-- Partial index on the exception, not the norm. Almost every row is
-- approved, so an index over the whole column would be dead weight;
-- what we actually query for is "show me what to sweep".
CREATE INDEX IF NOT EXISTS "Photo_moderation_review_idx"
  ON public."Photo" ("moderationStatus", "moderationCheckedAt")
  WHERE "moderationStatus" IN ('flagged', 'rejected');
