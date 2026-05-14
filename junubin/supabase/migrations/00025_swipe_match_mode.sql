-- 00025 — Record the app mode (Dating vs Social) on each swipe and
-- match so the Messages list can sort/segregate conversations by the
-- mode the user is currently in.
--
-- Before this migration, Match and Swipe rows carried no mode, which
-- meant a user who swiped in Dating mode and later opened Messages in
-- Social mode saw the same flat list with no way to tell which mode
-- each conversation came from. The client tried to derive intent from
-- the *current* user's mode toggle, which is wrong — mode belongs to
-- the moment the swipe happened, not the moment the inbox opens.
--
-- Stored as plain TEXT with a CHECK constraint instead of an enum so
-- we don't need a separate ALTER TYPE migration if we ever add a third
-- mode (e.g. 'community'). Default 'dating' matches the historic
-- client behavior — every existing row pre-dates the toggle, so we
-- backfill from the swiper's current appMode where available and fall
-- through to 'dating' otherwise.

ALTER TABLE "Swipe"
    ADD COLUMN IF NOT EXISTS "mode" TEXT
      CHECK ("mode" IN ('dating', 'social'));

ALTER TABLE "Match"
    ADD COLUMN IF NOT EXISTS "mode" TEXT
      CHECK ("mode" IN ('dating', 'social'));

-- Backfill: read mode from the swiper's Profile.appMode (00016) when
-- available; fall through to 'dating' otherwise. Runs once on rollout.
UPDATE "Swipe" s
SET "mode" = COALESCE(
    (SELECT
        CASE p."appMode"
            WHEN 'social' THEN 'social'
            WHEN 'dating' THEN 'dating'
            ELSE CASE p."accountPurpose"
                WHEN 'socialize' THEN 'social'
                ELSE 'dating'
            END
        END
     FROM "Profile" p WHERE p."userId" = s."fromUserId"),
    'dating'
)
WHERE s."mode" IS NULL;

-- For Match rows, pick the mode of whichever swipe came first — that's
-- the swipe that initiated the pairing. Falls through to 'dating' if
-- neither Swipe row has a mode set (shouldn't happen after the Swipe
-- backfill above, but the COALESCE keeps the column non-NULL safe).
UPDATE "Match" m
SET "mode" = COALESCE(
    (SELECT s."mode"
       FROM "Swipe" s
      WHERE (s."fromUserId" = m."userAId" AND s."toUserId" = m."userBId")
         OR (s."fromUserId" = m."userBId" AND s."toUserId" = m."userAId")
      ORDER BY s."createdAt" ASC
      LIMIT 1),
    'dating'
)
WHERE m."mode" IS NULL;

-- Now that every row has a value, lock in the default for future
-- inserts. The edge function should always pass `mode` explicitly, but
-- the default makes the column robust to legacy clients and SQL admin
-- inserts that don't set it.
ALTER TABLE "Swipe" ALTER COLUMN "mode" SET DEFAULT 'dating';
ALTER TABLE "Swipe" ALTER COLUMN "mode" SET NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "mode" SET DEFAULT 'dating';
ALTER TABLE "Match" ALTER COLUMN "mode" SET NOT NULL;

-- Index Match.mode for the common "this user's conversations in mode X
-- ordered by recency" query that MessagesScreen now issues. The
-- existing index on (userAId/userBId, updatedAt) is unchanged — this
-- one composites on top to keep the per-mode scan cheap once the
-- table grows past a few hundred rows.
CREATE INDEX IF NOT EXISTS "Match_mode_updated_idx"
    ON "Match" ("mode", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "Swipe_to_mode_created_idx"
    ON "Swipe" ("toUserId", "mode", "createdAt" DESC);

COMMENT ON COLUMN "Swipe"."mode" IS
    'App mode the swiper was in when this swipe was recorded. Used to scope match/like surfacing in MessagesScreen.';
COMMENT ON COLUMN "Match"."mode" IS
    'App mode of the swipe that created this match (mode of the first reciprocal like). Drives MessagesScreen sort order.';
