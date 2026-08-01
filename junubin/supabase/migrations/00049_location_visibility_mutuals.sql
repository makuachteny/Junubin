-- 00049 — locationVisibility: add the `mutuals` level.
--
-- 00047 gave Profile three location-privacy levels (off / city /
-- coarse). The rebuilt privacy sheet offers three DIFFERENT ones:
--
--   1. "Everyone on JuNubin"  — your approximate area shows on Nearby.
--   2. "Mutual follows only"  — only people you BOTH follow see it.
--   3. "Nobody"               — you browse the map, you never appear.
--
-- There was no value meaning (2), so the UI had been substituting
-- 'city' for it — a control that says "only mutual follows can see
-- your area" while the server hands the user to every caller is a
-- privacy lie, not a rendering detail. This migration adds the real
-- value; `discover-nearby` and `directory` enforce it.
--
-- Purely additive. 'city' keeps its own meaning (city-granularity
-- visibility to everyone) because rows already carry it and OTA
-- clients of several versions read this column at the same time —
-- reinterpreting an existing value would silently change what those
-- users consented to.

-- ── Widen the CHECK ──────────────────────────────────────────────────
-- Drop-and-recreate rather than ADD ... NOT VALID: the set only grows,
-- so every existing row still satisfies the new constraint and the
-- validation scan is cheap. No row is rewritten and no default moves;
-- 'off' is still the default, for the same App Review reason 00032 and
-- 00047 both give.
ALTER TABLE "Profile"
  DROP CONSTRAINT IF EXISTS "Profile_locationVisibility_chk";

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_locationVisibility_chk"
  CHECK ("locationVisibility" IN ('off', 'city', 'coarse', 'mutuals'));

COMMENT ON COLUMN "Profile"."locationVisibility" IS
  'off | city | coarse | mutuals. Supersedes shareLocation; the two are kept in sync by trg_sync_location_visibility. `mutuals` = visible at coarse granularity, but only to users the owner mutually follows.';

-- ── The 00047 sync trigger is already correct for `mutuals` ──────────
-- Deliberately NOT re-created here. Walking every branch of
-- public.sync_location_visibility() with the new value:
--
--   INSERT, lv='mutuals'          → first branch is false (lv <> 'off'),
--                                   so shareLocation := (lv <> 'off')
--                                   = TRUE. Correct — a `mutuals` user
--                                   IS sharing location, just to a
--                                   restricted audience.
--   UPDATE lv → 'mutuals'         → shareLocation := TRUE. Same.
--   UPDATE lv 'mutuals' → 'off'    → shareLocation := FALSE.
--   Legacy writer sets shareLocation=TRUE while lv='mutuals'
--                                 → the `lv = 'off'` guard fails, so
--                                   the explicit 'mutuals' choice is
--                                   left alone. This is exactly the
--                                   clobber-protection 00047 added for
--                                   'city'.
--   Legacy writer sets shareLocation=FALSE while lv='mutuals'
--                                 → lv := 'off'. Correct: an old build
--                                   turning "Appear on map" off means
--                                   off.
--
-- So the legacy boolean stays a faithful "am I on the map at all?"
-- projection of the new level, and no OTA client needs to learn the
-- word 'mutuals' to keep working.

-- ── Indexes ─────────────────────────────────────────────────────────
-- Profile_locationVisibility_idx (00047) is partial on
-- `<> 'off'`, so 'mutuals' rows are already covered by it — the
-- candidate scan in discover-nearby is unchanged.
--
-- The mutual-follow check is two set lookups against the caller's own
-- follow graph (Follow.followerId = me, Follow.followingId = me), both
-- of which are served by Follow_followerId_idx / Follow_followingId_idx
-- from 00004. Nothing new is needed.

NOTIFY pgrst, 'reload schema';
