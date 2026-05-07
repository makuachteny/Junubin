-- Calls — voice/video call history
--
-- Each row records the lifecycle of a single call attempt: caller, peer,
-- type, status (dialing → answered/declined/missed/cancelled/completed), and
-- duration. Driven by the client-side `callService` over Supabase Realtime
-- signaling; the row is written when the call ends so its final state is
-- known.

CREATE TABLE IF NOT EXISTS "Call" (
  "id"                TEXT PRIMARY KEY,
  "callerId"          TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "peerId"            TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "callType"          TEXT NOT NULL CHECK ("callType" IN ('voice', 'video')),
  "status"            TEXT NOT NULL CHECK ("status" IN (
    'dialing', 'answered', 'completed', 'declined', 'missed', 'cancelled', 'failed'
  )),
  "durationSeconds"   INTEGER NOT NULL DEFAULT 0,
  "conversationId"    TEXT REFERENCES "Conversation"("id") ON DELETE SET NULL,
  "startedAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "endedAt"           TIMESTAMPTZ,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "Call_callerId_createdAt_idx"
  ON "Call" ("callerId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Call_peerId_createdAt_idx"
  ON "Call" ("peerId", "createdAt" DESC);

ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;

-- Either side of the call (caller OR peer) can read it.
CREATE POLICY "Call participants can read calls"
  ON "Call" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
      AND (u.id = "Call"."callerId" OR u.id = "Call"."peerId")
    )
  );

-- Only the caller can insert a Call row, and only with their own ID as caller.
CREATE POLICY "Caller can insert own calls"
  ON "Call" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid() AND u.id = "Call"."callerId"
    )
  );

-- Either side can update status / duration / endedAt (e.g. the receiver
-- patching status on accept, or either side patching on hangup).
CREATE POLICY "Call participants can update calls"
  ON "Call" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.auth_id = auth.uid()
      AND (u.id = "Call"."callerId" OR u.id = "Call"."peerId")
    )
  );
