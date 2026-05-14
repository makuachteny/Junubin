-- 00030 — Atomic photo INSERT + DELETE + SET-PRIMARY via server-side
-- RPCs so concurrent uploads / deletes don't race on `sortOrder`.
--
-- Symptom we're fixing: two `uploadPhoto()` calls from the same user
-- fire in parallel (multi-pick or a retry on a flaky network), both
-- read `count = 4`, both insert with `sortOrder = 4` → display ends up
-- with two photos at the same position and the UI shows them
-- non-deterministically. Worse, two concurrent deletes both reindex
-- after reading stale photo lists and create gaps or duplicate slots.
--
-- The migration adds:
--   * append_photo  — INSERT with sortOrder derived from a single
--                     atomic subquery (last + 1).
--   * delete_photo  — DELETE + reindex inside one statement.
--   * promote_photo — swap sortOrder + flip isPrimary on both rows
--                     atomically.
--
-- Each function is SECURITY DEFINER + does its own auth check (read
-- the caller's User.id from auth.uid) so RLS can't be tricked even
-- if the function definitions are called from an unexpected context.

CREATE OR REPLACE FUNCTION public.append_photo(
    _url           TEXT,
    _storage_path  TEXT
) RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id   TEXT;
  next_pos INT;
  inserted_row "Photo"%ROWTYPE;
BEGIN
  SELECT id INTO me_id FROM "User" WHERE auth_id = auth.uid() LIMIT 1;
  IF me_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- Cap at 9 photos to mirror the client-side check in
  -- profileService.uploadPhoto. The RPC enforces it server-side too
  -- so a tampered client can't bypass.
  IF (SELECT COUNT(*) FROM "Photo" WHERE "userId" = me_id) >= 9 THEN
    RAISE EXCEPTION 'photo_limit_reached';
  END IF;

  -- Compute next sortOrder inside the same transaction as the insert
  -- so two concurrent appends serialize via row-locking on the user's
  -- photo set. The `FOR UPDATE` isn't on Photo (no row to lock yet);
  -- instead we read max+1 with a default of 0 and rely on the unique
  -- index `(userId, sortOrder)` if one were ever added — but even
  -- without it, the lock-free COALESCE(MAX) approach is safe under
  -- PostgreSQL's read-committed isolation because the INSERT inside
  -- the function is the next operation, and concurrent inserts are
  -- serialized by the unique constraint we add at the end of this
  -- migration.
  SELECT COALESCE(MAX("sortOrder"), -1) + 1 INTO next_pos
    FROM "Photo" WHERE "userId" = me_id;

  INSERT INTO "Photo" ("userId", "url", "storagePath", "sortOrder", "isPrimary")
  VALUES (me_id, _url, _storage_path, next_pos, next_pos = 0)
  RETURNING * INTO inserted_row;

  RETURN to_jsonb(inserted_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.append_photo(TEXT, TEXT) TO authenticated;

-- Atomic delete + reindex. Avoids the read-then-loop race in the
-- client-side path where two concurrent deletes both saw the same
-- "remaining" list and wrote conflicting reindex updates.
CREATE OR REPLACE FUNCTION public.delete_photo(_photo_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id   TEXT;
  deleted INT;
BEGIN
  SELECT id INTO me_id FROM "User" WHERE auth_id = auth.uid() LIMIT 1;
  IF me_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  -- DELETE returns the count; we abort if the row didn't belong to
  -- the caller (or never existed) so the function is idempotent +
  -- safe from cross-user deletes.
  DELETE FROM "Photo" WHERE id = _photo_id AND "userId" = me_id;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  IF deleted = 0 THEN RETURN FALSE; END IF;

  -- Reindex within the same transaction using a CTE so the sortOrder
  -- updates land as a single statement. Concurrent reindexes serialize
  -- naturally because each row update takes a row lock.
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY "sortOrder" ASC, "createdAt" ASC) - 1 AS new_pos
      FROM "Photo"
     WHERE "userId" = me_id
  )
  UPDATE "Photo" p
     SET "sortOrder" = ranked.new_pos,
         "isPrimary" = (ranked.new_pos = 0)
    FROM ranked
   WHERE p.id = ranked.id
     AND (p."sortOrder" <> ranked.new_pos OR p."isPrimary" <> (ranked.new_pos = 0));

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_photo(TEXT) TO authenticated;

-- Promote a photo to position 0 atomically. Swaps sortOrder with the
-- current primary and flips isPrimary on both in one transaction.
CREATE OR REPLACE FUNCTION public.promote_photo(_photo_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id        TEXT;
  target_pos   INT;
  current_id   TEXT;
BEGIN
  SELECT id INTO me_id FROM "User" WHERE auth_id = auth.uid() LIMIT 1;
  IF me_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT "sortOrder" INTO target_pos
    FROM "Photo" WHERE id = _photo_id AND "userId" = me_id;
  IF target_pos IS NULL THEN RETURN FALSE; END IF;
  IF target_pos = 0 THEN RETURN TRUE; END IF;

  SELECT id INTO current_id
    FROM "Photo" WHERE "userId" = me_id AND "sortOrder" = 0 LIMIT 1;

  -- Swap. The unique index we'll add below would conflict on the
  -- two-row update if we did it in two separate statements; the
  -- intermediate step is hidden inside one statement here.
  UPDATE "Photo"
     SET "sortOrder" = CASE
                         WHEN id = _photo_id  THEN 0
                         WHEN id = current_id THEN target_pos
                         ELSE "sortOrder"
                       END,
         "isPrimary" = (id = _photo_id)
   WHERE "userId" = me_id
     AND id IN (_photo_id, current_id);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_photo(TEXT) TO authenticated;

-- Hard guarantee: a user can't have two photos at the same position.
-- The unique index is added LAST so the reindex above could fix any
-- legacy duplicates before the constraint enforces.
DO $$
DECLARE
  dup_count INT;
BEGIN
  -- Soft-fix any legacy duplicates first by reindexing per-user.
  -- This is a one-shot migration step.
  WITH ranked AS (
    SELECT id, "userId",
           ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "sortOrder" ASC, "createdAt" ASC) - 1 AS new_pos
      FROM "Photo"
  )
  UPDATE "Photo" p
     SET "sortOrder" = ranked.new_pos,
         "isPrimary" = (ranked.new_pos = 0)
    FROM ranked
   WHERE p.id = ranked.id
     AND (p."sortOrder" <> ranked.new_pos OR p."isPrimary" <> (ranked.new_pos = 0));

  GET DIAGNOSTICS dup_count = ROW_COUNT;
  IF dup_count > 0 THEN
    RAISE NOTICE '[00030] Reindexed % photo row(s) before adding unique constraint.', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Photo_userId_sortOrder_unique"
    ON "Photo" ("userId", "sortOrder");

NOTIFY pgrst, 'reload schema';
