-- 00016 — Server-side incognito flag + cross-device prefs.
--
-- The "incognito" toggle ("hide me from discover") was AsyncStorage-only,
-- so a user who turned it on on their phone would still appear in
-- everyone's deck through any other device they use (including web).
-- Move the source of truth to the Profile row so all devices honor it,
-- and let the discover Edge Function skip incognito users at fetch time.
--
-- Also adds the `appMode` field as the canonical Dating-vs-Social
-- preference. The previous AsyncStorage `@junubin_mode` flag worked
-- on a single device but diverged across installs. Reading from
-- `Profile.appMode || Profile.accountPurpose` keeps the resolveMode
-- function deterministic without breaking existing users.

ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "incognito"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "appMode"    TEXT
    CHECK ("appMode" IS NULL OR "appMode" IN ('dating', 'social'));

CREATE INDEX IF NOT EXISTS "Profile_incognito_idx"
  ON "Profile" ("incognito") WHERE "incognito" = TRUE;
