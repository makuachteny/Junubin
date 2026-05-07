-- 00011 — Events + Attendees + push-token columns on User.
--
-- Three deployment-blocker fixes bundled here:
--
-- 1. `Event` + `EventAttendee` tables — referenced by the
--    `event-ticket-pkpass` Edge Function and by `eventStore.js` once we
--    move the local AsyncStorage prototype to a real backend. Without
--    these, the wallet-pass function 500s on every call.
-- 2. `pushToken` + `pushTokenPlatform` columns on `User` — needed for
--    server-side notification delivery (match, message, like). Until
--    these existed, `registerForPushNotifications` generated tokens
--    but had nowhere to store them, so no push could ever be delivered.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "pushToken"         TEXT,
  ADD COLUMN IF NOT EXISTS "pushTokenPlatform" TEXT
    CHECK ("pushTokenPlatform" IN ('ios', 'android', 'web'));

-- Skinny lookup index — push senders only need to know which users have
-- a token. Filtered partial index keeps it tiny.
CREATE INDEX IF NOT EXISTS "User_push_idx"
  ON "User" ("id")
  WHERE "pushToken" IS NOT NULL;

-- ── 3. MessageReaction ───────────────────────────────────────────────
-- Reactions on chat messages. Same user can hit the same emoji on the
-- same message at most once (UNIQUE constraint), and a Realtime
-- subscription on this table is what powers the "tap a message → emoji
-- pops on every device" experience. Replaces the previous local-only
-- reaction state in ChatScreen which vanished on app reload.
CREATE TABLE IF NOT EXISTS "MessageReaction" (
  "id"        TEXT PRIMARY KEY,
  "messageId" TEXT NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "emoji"     TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "MessageReaction_unique"
    UNIQUE ("messageId", "userId", "emoji")
);

CREATE INDEX IF NOT EXISTS "MessageReaction_message_idx"
  ON "MessageReaction" ("messageId");

ALTER TABLE "MessageReaction" ENABLE ROW LEVEL SECURITY;

-- Anyone in the conversation can see all reactions on its messages.
CREATE POLICY "Reactions visible to conversation members"
  ON "MessageReaction" FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM "Message" m
      JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId"
      JOIN "User" u                ON u.id = cm."userId"
      WHERE m.id = "MessageReaction"."messageId"
        AND u.auth_id = auth.uid()
    )
  );

-- Users can only react under their own user id, on a message in a
-- conversation they belong to.
CREATE POLICY "Member can react"
  ON "MessageReaction" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "MessageReaction"."userId"
    )
    AND EXISTS (
      SELECT 1
      FROM "Message" m
      JOIN "ConversationMember" cm ON cm."conversationId" = m."conversationId"
      JOIN "User" u                ON u.id = cm."userId"
      WHERE m.id = "MessageReaction"."messageId"
        AND u.auth_id = auth.uid()
    )
  );

-- Only the reactor themselves can remove their own reaction.
CREATE POLICY "Reactor can delete own"
  ON "MessageReaction" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "MessageReaction"."userId"
    )
  );

-- ── 4. Storage buckets ───────────────────────────────────────────────
-- Both buckets store the path prefix as the user's app id (`<userId>/...`)
-- so per-user write policies work via path inspection. Buckets are public
-- so the in-app `<Image source={{uri}}>` and `<ChatAudioBubble uri>` can
-- load without signed-URL minting on every render. The unguessable path
-- structure (timestamps + UUIDs) is the access control.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('photos', 'photos', TRUE)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('voice-notes', 'voice-notes', TRUE)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Photos: any user can read; users can only insert/update/delete files
-- where the first path segment matches their own User.id.
DROP POLICY IF EXISTS "Photos public read"  ON storage.objects;
DROP POLICY IF EXISTS "Photos owner write"  ON storage.objects;
DROP POLICY IF EXISTS "Photos owner update" ON storage.objects;
DROP POLICY IF EXISTS "Photos owner delete" ON storage.objects;

CREATE POLICY "Photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photos');

CREATE POLICY "Photos owner write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Photos owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Photos owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND u.id = (storage.foldername(name))[1]
    )
  );

-- Voice notes: scoped by conversation. The Message INSERT policy
-- on the Message table already restricts who can attach an audio
-- message; the storage policy here gates the underlying file write
-- to "you must be a member of the conversation matching the path
-- prefix". Path layout is `<conversationId>/<senderId>-<ts>.m4a`.
DROP POLICY IF EXISTS "Voice notes member read"  ON storage.objects;
DROP POLICY IF EXISTS "Voice notes member write" ON storage.objects;

CREATE POLICY "Voice notes member read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'voice-notes'
    AND EXISTS (
      SELECT 1
      FROM "ConversationMember" cm
      JOIN "User" u ON u.id = cm."userId"
      WHERE u.auth_id = auth.uid()
        AND cm."conversationId" = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Voice notes member write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND EXISTS (
      SELECT 1
      FROM "ConversationMember" cm
      JOIN "User" u ON u.id = cm."userId"
      WHERE u.auth_id = auth.uid()
        AND cm."conversationId" = (storage.foldername(name))[1]
    )
  );

CREATE TABLE IF NOT EXISTS "Event" (
  "id"               TEXT PRIMARY KEY,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "location"         TEXT,
  "city"             TEXT,
  "category"         TEXT,
  "date"             TEXT,        -- YYYY-MM-DD; matches the client format
  "time"             TEXT,        -- "7:00 PM" string; intentional, not TIMESTAMPTZ
  "isFree"           BOOLEAN NOT NULL DEFAULT TRUE,
  "ticketPrice"      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  "ticketsTotal"     INTEGER,
  "ticketsRemaining" INTEGER,
  "organizerId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "organizerName"    TEXT,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Event_date_idx"        ON "Event" ("date");
CREATE INDEX IF NOT EXISTS "Event_organizer_idx"   ON "Event" ("organizerId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Event_city_cat_idx"    ON "Event" ("city", "category");

CREATE TABLE IF NOT EXISTS "EventAttendee" (
  "id"          TEXT PRIMARY KEY,
  "eventId"     TEXT NOT NULL REFERENCES "Event"("id") ON DELETE CASCADE,
  "userId"      TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name"        TEXT,
  "paid"        BOOLEAN NOT NULL DEFAULT FALSE,
  "amount"      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  "ticketCode"  TEXT NOT NULL UNIQUE,
  "checkedIn"   BOOLEAN NOT NULL DEFAULT FALSE,
  "checkedInAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EventAttendee_event_user_unique" UNIQUE ("eventId", "userId")
);

CREATE INDEX IF NOT EXISTS "EventAttendee_event_idx"    ON "EventAttendee" ("eventId");
CREATE INDEX IF NOT EXISTS "EventAttendee_user_idx"     ON "EventAttendee" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "EventAttendee_ticket_idx"   ON "EventAttendee" ("ticketCode");

ALTER TABLE "Event"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventAttendee" ENABLE ROW LEVEL SECURITY;

-- Events: anyone authenticated can read, only the organizer can mutate.
CREATE POLICY "Events readable by everyone"
  ON "Event" FOR SELECT USING (TRUE);

CREATE POLICY "Organizer can insert own events"
  ON "Event" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Event"."organizerId"
    )
  );

CREATE POLICY "Organizer can update own events"
  ON "Event" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Event"."organizerId"
    )
  );

CREATE POLICY "Organizer can delete own events"
  ON "Event" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Event"."organizerId"
    )
  );

-- Attendees: a user can see their own ticket + the organizer can see all
-- attendees of their event. Only the user themselves can insert their own
-- attendance row (server-side via service-role bypasses this for paid
-- ticket grants from Stripe / Flutterwave webhooks).
CREATE POLICY "Attendee can read own + organizer reads all"
  ON "EventAttendee" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
        AND (
          u.id = "EventAttendee"."userId"
          OR u.id IN (SELECT e."organizerId" FROM "Event" e WHERE e.id = "EventAttendee"."eventId")
        )
    )
  );

CREATE POLICY "User can RSVP themselves"
  ON "EventAttendee" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "EventAttendee"."userId"
    )
  );

CREATE POLICY "Attendee can cancel own RSVP"
  ON "EventAttendee" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "EventAttendee"."userId"
    )
  );
