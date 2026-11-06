-- 00032 — Profile.shareLocation opt-in for the Snap-Map-style "people
-- nearby" view on the Connect / Home tab.
--
-- Privacy choice: location-on-map is OFF by default. A user must
-- explicitly turn it on from Settings → Privacy → "Appear on map".
-- Without this, App Review would reject a dating app that broadcasts
-- everyone's coordinates by default — and frankly so should we.
--
-- Behaviour matrix:
--
--   shareLocation = FALSE  → user does NOT appear on anyone's map.
--                             They can still browse the map.
--   shareLocation = TRUE   → user appears on the map at a coordinate
--                             rounded to ~1km grid (the rounding is
--                             done client-side in the map component,
--                             not here — the DB stores raw lat/long
--                             on User.latitude / User.longitude).
--
-- The discover Edge Function (and the future getNearbyUsers RPC) join
-- against this column so the map query returns only opted-in users.

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "shareLocation" BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN "Profile"."shareLocation" IS
  'User opt-in to appear on the in-app map. Default FALSE. Coordinates are bucketed to ~1km client-side when displayed.';

-- Tightened index for the common map query: "users with shareLocation
-- on, plus a valid lat/long, plus active status".
CREATE INDEX IF NOT EXISTS "Profile_shareLocation_idx"
  ON "Profile" ("shareLocation")
  WHERE "shareLocation" = TRUE;

NOTIFY pgrst, 'reload schema';
