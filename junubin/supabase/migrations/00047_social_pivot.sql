-- 00047 — Social pivot, phase 1 (data layer).
--
-- JuNubin is moving from a swipe-first dating product to a South
-- Sudanese social / community platform. Phase 1 needs three things
-- from the database that don't exist yet:
--
--   1. Richer, directory-oriented Profile fields (languages spoken,
--      what the person is open to, profession) plus a real
--      location-privacy control that is more expressive than the
--      single `shareLocation` boolean from 00032.
--   2. A MessageRequest inbox, so a stranger can ask to start a
--      conversation instead of the dating-era "you must match first"
--      gate. Accepting a request mints a normal Conversation, so
--      every existing chat surface keeps working untouched.
--   3. A widened `User` SELECT policy so the counterparty of a
--      message request actually renders (00029 narrowed User reads to
--      people you already have a relationship with).
--
-- Everything here is additive. Swipe / Match / Conversation and all
-- their policies are left exactly as they are — OTA clients of several
-- versions hit this database at the same time and the dating surfaces
-- are still live during the migration.

-- ============================================================================
-- #1 — Profile: directory + location-privacy columns
-- ============================================================================
-- `languages` and `openTo` are JSONB arrays of plain strings (badge
-- keys for openTo — 'mentorship', 'business', 'friendship', …). We
-- keep them as JSONB rather than TEXT[] to match `interests` /
-- `stickers` / `currentlyInto` from 00001, which the client already
-- reads and writes as JSON arrays.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "languages"  JSONB,
  ADD COLUMN IF NOT EXISTS "openTo"     JSONB,
  ADD COLUMN IF NOT EXISTS "profession" TEXT;

-- Location visibility replaces the shareLocation boolean with three
-- levels. `off` is still the default — a community app broadcasting
-- everyone's neighbourhood by default is the same App Review problem
-- 00032 was written to avoid.
--
--   'off'    → invisible on the map / nearby surfaces entirely.
--   'city'   → visible at city granularity only.
--   'coarse' → visible at the ~1km bucketed coordinate that
--              discover-nearby already snaps to on the wire.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "locationVisibility" TEXT NOT NULL DEFAULT 'off';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Profile_locationVisibility_chk'
  ) THEN
    ALTER TABLE "Profile"
      ADD CONSTRAINT "Profile_locationVisibility_chk"
      CHECK ("locationVisibility" IN ('off', 'city', 'coarse'));
  END IF;
END $$;

-- Temporary sharing ("show me on the map for the next 3 hours").
-- NULL means indefinite; a past timestamp means the window closed and
-- the reader must treat the user as `off` without needing a cron job
-- to flip the column back. discover-nearby enforces this.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "locationVisibleUntil" TIMESTAMPTZ;

-- Directory opt-out. Default TRUE: the people directory is the core
-- of the pivot and an empty directory is a dead product. Users who
-- want out flip this from Settings → Privacy.
ALTER TABLE "Profile"
  ADD COLUMN IF NOT EXISTS "directoryVisible" BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN "Profile"."languages" IS
  'JSONB array of language names the user speaks. Directory filter facet.';
COMMENT ON COLUMN "Profile"."openTo" IS
  'JSONB array of badge keys describing what the user is open to (mentorship, business, friendship, …).';
COMMENT ON COLUMN "Profile"."profession" IS
  'Free-text profession. Distinct from `job` (employer/role) — this is the directory-facing category.';
COMMENT ON COLUMN "Profile"."locationVisibility" IS
  'off | city | coarse. Supersedes shareLocation; the two are kept in sync by trg_sync_location_visibility.';
COMMENT ON COLUMN "Profile"."locationVisibleUntil" IS
  'End of a temporary location-sharing window. NULL = indefinite. A past value means not visible.';
COMMENT ON COLUMN "Profile"."directoryVisible" IS
  'Opt-out of the searchable people directory. Default TRUE.';

-- Backfill from the 00032 boolean. shareLocation = TRUE meant "show me
-- on the map at the ~1km bucket", which is exactly `coarse` — anything
-- less precise would silently downgrade an existing opt-in.
UPDATE "Profile"
   SET "locationVisibility" = 'coarse'
 WHERE "shareLocation" = TRUE
   AND "locationVisibility" = 'off';

-- ── Keep shareLocation and locationVisibility in sync ────────────────
-- `discover-nearby` (pre-deploy), the profile fetch path, and any OTA
-- client still on the old build read `shareLocation`. Rather than
-- rewrite every reader at once we make the two columns two views of
-- the same state, synced in whichever direction the writer touched:
--
--   * writer changed locationVisibility → derive shareLocation
--   * writer changed only shareLocation (legacy client / legacy
--     PROFILE_KEYS save) → derive locationVisibility
--
-- Without the second branch a legacy client flipping "Appear on map"
-- would have its write immediately stomped back to false.
CREATE OR REPLACE FUNCTION public.sync_location_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- On insert, whichever field was set explicitly wins; if the row
    -- opted in via the legacy boolean only, promote it to 'coarse'.
    IF NEW."locationVisibility" = 'off' AND NEW."shareLocation" = TRUE THEN
      NEW."locationVisibility" := 'coarse';
    ELSE
      NEW."shareLocation" := (NEW."locationVisibility" <> 'off');
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."locationVisibility" IS DISTINCT FROM OLD."locationVisibility" THEN
    NEW."shareLocation" := (NEW."locationVisibility" <> 'off');
  ELSIF NEW."shareLocation" IS DISTINCT FROM OLD."shareLocation" THEN
    -- Legacy writer. Only touch locationVisibility when the derived
    -- state actually disagrees, so turning the boolean back on doesn't
    -- clobber a user's explicit 'city' choice.
    IF NEW."shareLocation" = TRUE AND NEW."locationVisibility" = 'off' THEN
      NEW."locationVisibility" := 'coarse';
    ELSIF NEW."shareLocation" = FALSE THEN
      NEW."locationVisibility" := 'off';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_location_visibility ON "Profile";
CREATE TRIGGER trg_sync_location_visibility
    BEFORE INSERT OR UPDATE ON "Profile"
    FOR EACH ROW EXECUTE FUNCTION public.sync_location_visibility();

-- Directory scan index. Partial on the opted-in set because the
-- opted-out rows are never scanned by the directory function.
CREATE INDEX IF NOT EXISTS "Profile_directoryVisible_idx"
  ON "Profile" ("directoryVisible")
  WHERE "directoryVisible" = TRUE;

CREATE INDEX IF NOT EXISTS "Profile_locationVisibility_idx"
  ON "Profile" ("locationVisibility")
  WHERE "locationVisibility" <> 'off';

-- ============================================================================
-- #2 — MessageRequest
-- ============================================================================
-- The social pivot's replacement for "swipe right and hope". Anyone
-- who can see you in the directory can send ONE pending request with a
-- short note; you accept (which mints a Conversation) or decline.
--
-- The unique index on (fromUserId, toUserId) is the anti-spam guard:
-- a declined request stays on the table, so the sender cannot re-send
-- by deleting and retrying. Withdrawing/re-requesting, if we ever want
-- it, becomes an explicit status transition rather than a new row.
CREATE TABLE IF NOT EXISTS "MessageRequest" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "fromUserId"     TEXT NOT NULL,
    "toUserId"       TEXT NOT NULL,
    "message"        TEXT,
    "status"         TEXT NOT NULL DEFAULT 'pending'
        CHECK ("status" IN ('pending', 'accepted', 'declined')),
    "conversationId" TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "respondedAt"    TIMESTAMPTZ,
    CONSTRAINT "MessageRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageRequest_fromUserId_toUserId_key"
    ON "MessageRequest" ("fromUserId", "toUserId");
CREATE INDEX IF NOT EXISTS "MessageRequest_toUserId_status_idx"
    ON "MessageRequest" ("toUserId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageRequest_fromUserId_fkey'
  ) THEN
    ALTER TABLE "MessageRequest"
      ADD CONSTRAINT "MessageRequest_fromUserId_fkey"
      FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageRequest_toUserId_fkey'
  ) THEN
    ALTER TABLE "MessageRequest"
      ADD CONSTRAINT "MessageRequest_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageRequest_conversationId_fkey'
  ) THEN
    ALTER TABLE "MessageRequest"
      ADD CONSTRAINT "MessageRequest_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageRequest_no_self_request'
  ) THEN
    ALTER TABLE "MessageRequest"
      ADD CONSTRAINT "MessageRequest_no_self_request"
      CHECK ("fromUserId" <> "toUserId");
  END IF;
END $$;

ALTER TABLE "MessageRequest" ENABLE ROW LEVEL SECURITY;

-- Both parties read the row. The sender needs it to render
-- "requested"; the recipient needs it for their request inbox.
DROP POLICY IF EXISTS "MessageRequest_select" ON "MessageRequest";
CREATE POLICY "MessageRequest_select"
    ON "MessageRequest" FOR SELECT
    USING (
        "fromUserId" = public.current_user_id()
        OR "toUserId" = public.current_user_id()
    );

-- Sender inserts as themselves, in 'pending', with no conversation
-- attached — the RPC is the only thing that may set conversationId.
-- Block is honoured in both directions, same shape as the Message
-- INSERT policy in 00033: a user who blocked you (or whom you blocked)
-- can't be reached through the request inbox either.
DROP POLICY IF EXISTS "MessageRequest_insert" ON "MessageRequest";
CREATE POLICY "MessageRequest_insert"
    ON "MessageRequest" FOR INSERT
    WITH CHECK (
        "fromUserId" = public.current_user_id()
        AND "status" = 'pending'
        AND "conversationId" IS NULL
        AND NOT EXISTS (
            SELECT 1 FROM "Block" b
            WHERE (b."blockerId" = public.current_user_id() AND b."blockedId" = "MessageRequest"."toUserId")
               OR (b."blockerId" = "MessageRequest"."toUserId" AND b."blockedId" = public.current_user_id())
        )
    );

-- Only the recipient responds, and only into a terminal status. The
-- conversationId guard means a recipient can't point their row at a
-- conversation they aren't a member of (is_conversation_member is the
-- non-recursive helper from 00028).
DROP POLICY IF EXISTS "MessageRequest_update" ON "MessageRequest";
CREATE POLICY "MessageRequest_update"
    ON "MessageRequest" FOR UPDATE
    USING ("toUserId" = public.current_user_id())
    WITH CHECK (
        "toUserId" = public.current_user_id()
        AND "status" IN ('accepted', 'declined')
        AND (
            "conversationId" IS NULL
            OR public.is_conversation_member("conversationId", public.current_user_id())
        )
    );

-- ============================================================================
-- #3 — accept_message_request RPC
-- ============================================================================
-- Accepting has to do four things atomically: flip the request,
-- guarantee a Conversation exists for the pair, make both users
-- members, and hand the conversation id back to the client. Doing it
-- client-side would need three round trips with no transaction, and
-- the Conversation INSERT policy is `WITH CHECK (true)` precisely
-- because it was meant to be driven by server-side code.
--
-- Conversation.matchId is NOT NULL (00001), so a Conversation cannot
-- exist without a Match. Rather than loosen that constraint — which
-- every existing inbox query depends on — we mint a Match row with
-- mode='social'. That is also what makes the accepted request show up
-- in MessagesScreen with zero client changes, since getMatches() reads
-- Match, not Conversation.
--
-- Side effect we have to suppress: 00013's trg_notify_match fires
-- "It's a Match! 💛" on every Match INSERT, which is the wrong copy for
-- an accepted message request. We set a transaction-local GUC and
-- teach notify_match to skip when it's set, then send accurate copy
-- ourselves.
CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  name1 TEXT;
  name2 TEXT;
BEGIN
  -- Set by accept_message_request (transaction-local). Any other
  -- caller leaves it unset and the original behaviour is unchanged.
  IF coalesce(current_setting('junubin.suppress_match_push', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT "displayName" INTO name1 FROM "User" WHERE id = NEW."userAId";
  SELECT "displayName" INTO name2 FROM "User" WHERE id = NEW."userBId";

  PERFORM public.send_push(
    ARRAY[NEW."userAId"],
    'It''s a Match! 💛',
    coalesce(name2, 'Someone') || ' liked you back. Say hi!',
    jsonb_build_object('type', 'match', 'matchId', NEW.id, 'peerId', NEW."userBId")
  );
  PERFORM public.send_push(
    ARRAY[NEW."userBId"],
    'It''s a Match! 💛',
    coalesce(name1, 'Someone') || ' liked you back. Say hi!',
    jsonb_build_object('type', 'match', 'matchId', NEW.id, 'peerId', NEW."userAId")
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_message_request(request_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me_id        TEXT;
  req          "MessageRequest"%ROWTYPE;
  conv_id      TEXT;
  match_id     TEXT;
  pair_key     TEXT;
  user_a       TEXT;
  user_b       TEXT;
  my_name      TEXT;
BEGIN
  me_id := public.current_user_id();
  IF me_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Row lock so two taps on "Accept" can't both mint a conversation.
  SELECT * INTO req
    FROM "MessageRequest"
   WHERE id = request_id
   FOR UPDATE;

  IF req.id IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF req."toUserId" <> me_id THEN
    RAISE EXCEPTION 'not_recipient';
  END IF;

  -- Idempotent: a second accept returns the conversation the first
  -- one created instead of erroring or duplicating.
  IF req.status = 'accepted' AND req."conversationId" IS NOT NULL THEN
    RETURN req."conversationId";
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;

  -- Reuse an existing conversation between the pair if there is one —
  -- e.g. they matched in the dating era, unmatched, and are now
  -- reconnecting through the directory. Two membership rows on the
  -- same conversation is the definitive test.
  SELECT cm1."conversationId" INTO conv_id
    FROM "ConversationMember" cm1
    JOIN "ConversationMember" cm2
      ON cm2."conversationId" = cm1."conversationId"
   WHERE cm1."userId" = me_id
     AND cm2."userId" = req."fromUserId"
   ORDER BY cm1."joinedAt" ASC
   LIMIT 1;

  IF conv_id IS NULL THEN
    -- Same pairKey shape the swipe Edge Function builds
    -- (`[a, b].sort().join(":")`) so a Match created here and a Match
    -- created by a swipe collide on Match_pairKey_key rather than
    -- producing two rows for one pair.
    user_a   := LEAST(me_id, req."fromUserId");
    user_b   := GREATEST(me_id, req."fromUserId");
    pair_key := user_a || ':' || user_b;

    -- Suppress the dating-era "It's a Match!" push for the Match row
    -- we are about to create. Transaction-local, so it does not leak
    -- to any other statement.
    PERFORM set_config('junubin.suppress_match_push', 'on', true);

    SELECT id INTO match_id FROM "Match" WHERE "pairKey" = pair_key;
    IF match_id IS NULL THEN
      INSERT INTO "Match" ("pairKey", "userAId", "userBId", "mode", "status")
           VALUES (pair_key, user_a, user_b, 'social', 'active')
        RETURNING id INTO match_id;
    ELSE
      -- Re-activate a previously unmatched pair; accepting a request
      -- is an explicit consent signal from the recipient.
      UPDATE "Match" SET "status" = 'active', "updatedAt" = NOW() WHERE id = match_id;
    END IF;

    SELECT id INTO conv_id FROM "Conversation" WHERE "matchId" = match_id;
    IF conv_id IS NULL THEN
      INSERT INTO "Conversation" ("matchId") VALUES (match_id) RETURNING id INTO conv_id;
    END IF;
  END IF;

  INSERT INTO "ConversationMember" ("conversationId", "userId")
       VALUES (conv_id, me_id), (conv_id, req."fromUserId")
  ON CONFLICT ("conversationId", "userId") DO NOTHING;

  UPDATE "MessageRequest"
     SET "status"         = 'accepted',
         "respondedAt"    = NOW(),
         "conversationId" = conv_id
   WHERE id = req.id;

  -- Accurate copy for the sender, replacing the suppressed match push.
  SELECT "displayName" INTO my_name FROM "User" WHERE id = me_id;
  PERFORM public.send_push(
    ARRAY[req."fromUserId"],
    'Request accepted',
    coalesce(my_name, 'Someone') || ' accepted your message request.',
    jsonb_build_object('type', 'message_request_accepted', 'conversationId', conv_id, 'peerId', me_id)
  );

  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_message_request(TEXT) TO authenticated;

-- ============================================================================
-- #4 — Widen the User SELECT policy for message-request counterparties
-- ============================================================================
-- Re-creates the whole 00029 policy (self / Match / Swipe / Follow /
-- Post branches all preserved verbatim) and adds a MessageRequest
-- branch in either direction. Without it the request inbox renders a
-- list of blank cards: the row is readable but the sender's User row
-- is not.
DROP POLICY IF EXISTS "Users read connected users" ON "User";

CREATE POLICY "Users read connected users"
    ON "User" FOR SELECT
    USING (
        -- Self
        auth_id = auth.uid()
        -- Matches in either direction
        OR EXISTS (
            SELECT 1 FROM "Match" m
            WHERE m.status = 'active'
              AND (
                (m."userAId" = "User"."id" AND m."userBId" = public.current_user_id())
                OR (m."userBId" = "User"."id" AND m."userAId" = public.current_user_id())
              )
        )
        -- People I've swiped on, or who've swiped on me (Likes screen,
        -- whisper recipients, super-like senders all rely on this).
        OR EXISTS (
            SELECT 1 FROM "Swipe" s
            WHERE (s."fromUserId" = public.current_user_id() AND s."toUserId" = "User"."id")
               OR (s."toUserId" = public.current_user_id() AND s."fromUserId" = "User"."id")
        )
        -- Follow graph (FindFriends, FollowList screens). Bi-directional.
        OR EXISTS (
            SELECT 1 FROM "Follow" f
            WHERE (f."followerId" = public.current_user_id() AND f."followingId" = "User"."id")
               OR (f."followingId" = public.current_user_id() AND f."followerId" = "User"."id")
        )
        -- Message-request counterparties, either direction. Covers the
        -- incoming inbox (they requested me) and the outgoing/pending
        -- state on a profile card (I requested them). Status-agnostic
        -- on purpose — a declined request still needs the sender's
        -- name to render in the outgoing list.
        OR EXISTS (
            SELECT 1 FROM "MessageRequest" mr
            WHERE (mr."fromUserId" = public.current_user_id() AND mr."toUserId" = "User"."id")
               OR (mr."toUserId" = public.current_user_id() AND mr."fromUserId" = "User"."id")
        )
        -- Post authors the caller can already see via the public
        -- Post SELECT policy. Without this branch, the Community feed
        -- shows posts but every author User-join renders blank. The
        -- column is `userId` (00012_posts_safety_unmatch.sql), not
        -- `authorId` — earlier draft tripped a 42703 here. There's
        -- no soft-delete column on Post, so no deletedAt filter.
        OR EXISTS (
            SELECT 1 FROM "Post" p
            WHERE p."userId" = "User"."id"
        )
    );

NOTIFY pgrst, 'reload schema';
