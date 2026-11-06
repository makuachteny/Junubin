-- 00039 — Active liveness scaffold.
--
-- Adds the columns the new face-liveness Edge Function needs without
-- breaking the existing manual selfie-review path (00029
-- VerificationRequest). Both paths now coexist:
--
--   method = 'selfie'           — legacy upload + admin review
--   method = 'aws-face-liveness' — AWS Rekognition active liveness
--
-- The 00029 trigger that mirrors approve→User.isVerified is unchanged
-- — it runs on any row regardless of method.
--
-- All ADD COLUMN / ALTER are IF NOT EXISTS so a partial re-run is safe.

ALTER TABLE "VerificationRequest"
  ADD COLUMN IF NOT EXISTS "method"   TEXT NOT NULL DEFAULT 'selfie',
  ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- The legacy path always stamped photoUrl + storagePath. The new
-- liveness path doesn't have those (the session video lives in AWS,
-- not in our Storage). Allow nulls so liveness rows can land.
ALTER TABLE "VerificationRequest"
  ALTER COLUMN "photoUrl"    DROP NOT NULL,
  ALTER COLUMN "storagePath" DROP NOT NULL;

-- One pending request per user per method. Prevents a user from
-- spamming "create session" → racks up open rows.
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationRequest_user_method_pending"
  ON "VerificationRequest" ("userId", "method")
  WHERE "status" = 'pending';

NOTIFY pgrst, 'reload schema';
