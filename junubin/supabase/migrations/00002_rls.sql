-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Helper: get the app User.id for the current auth.uid()
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public."User" WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ============================================================================
-- User
-- ============================================================================
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active users"
    ON "User" FOR SELECT
    USING (auth.uid() IS NOT NULL AND "isActive" = true);

CREATE POLICY "Users can update own record"
    ON "User" FOR UPDATE
    USING (auth_id = auth.uid())
    WITH CHECK (auth_id = auth.uid());

CREATE POLICY "Users can insert own record"
    ON "User" FOR INSERT
    WITH CHECK (auth_id = auth.uid());

-- ============================================================================
-- Profile
-- ============================================================================
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read profiles"
    ON "Profile" FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own profile"
    ON "Profile" FOR UPDATE
    USING ("userId" = public.current_user_id())
    WITH CHECK ("userId" = public.current_user_id());

CREATE POLICY "Users can insert own profile"
    ON "Profile" FOR INSERT
    WITH CHECK ("userId" = public.current_user_id());

-- ============================================================================
-- Photo
-- ============================================================================
ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read photos"
    ON "Photo" FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own photos"
    ON "Photo" FOR INSERT
    WITH CHECK ("userId" = public.current_user_id());

CREATE POLICY "Users can update own photos"
    ON "Photo" FOR UPDATE
    USING ("userId" = public.current_user_id())
    WITH CHECK ("userId" = public.current_user_id());

CREATE POLICY "Users can delete own photos"
    ON "Photo" FOR DELETE
    USING ("userId" = public.current_user_id());

-- ============================================================================
-- Swipe
-- ============================================================================
ALTER TABLE "Swipe" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create swipes"
    ON "Swipe" FOR INSERT
    WITH CHECK ("fromUserId" = public.current_user_id());

CREATE POLICY "Users can read sent swipes"
    ON "Swipe" FOR SELECT
    USING (
        "fromUserId" = public.current_user_id()
        OR "toUserId" = public.current_user_id()
    );

CREATE POLICY "Users can update own swipes"
    ON "Swipe" FOR UPDATE
    USING ("fromUserId" = public.current_user_id())
    WITH CHECK ("fromUserId" = public.current_user_id());

-- ============================================================================
-- Match
-- ============================================================================
ALTER TABLE "Match" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own matches"
    ON "Match" FOR SELECT
    USING (
        "userAId" = public.current_user_id()
        OR "userBId" = public.current_user_id()
    );

CREATE POLICY "Users can insert matches"
    ON "Match" FOR INSERT
    WITH CHECK (
        "userAId" = public.current_user_id()
        OR "userBId" = public.current_user_id()
    );

-- ============================================================================
-- Conversation
-- ============================================================================
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read conversations"
    ON "Conversation" FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "ConversationMember"
            WHERE "ConversationMember"."conversationId" = "Conversation"."id"
            AND "ConversationMember"."userId" = public.current_user_id()
        )
    );

CREATE POLICY "Members can insert conversations"
    ON "Conversation" FOR INSERT
    WITH CHECK (true);  -- Controlled via edge function / match creation

-- ============================================================================
-- ConversationMember
-- ============================================================================
ALTER TABLE "ConversationMember" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read membership"
    ON "ConversationMember" FOR SELECT
    USING (
        "userId" = public.current_user_id()
        OR EXISTS (
            SELECT 1 FROM "ConversationMember" cm2
            WHERE cm2."conversationId" = "ConversationMember"."conversationId"
            AND cm2."userId" = public.current_user_id()
        )
    );

CREATE POLICY "System can insert members"
    ON "ConversationMember" FOR INSERT
    WITH CHECK (true);  -- Controlled via edge function / match creation

-- ============================================================================
-- Message
-- ============================================================================
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation members can read messages"
    ON "Message" FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM "ConversationMember"
            WHERE "ConversationMember"."conversationId" = "Message"."conversationId"
            AND "ConversationMember"."userId" = public.current_user_id()
        )
    );

CREATE POLICY "Conversation members can send messages"
    ON "Message" FOR INSERT
    WITH CHECK (
        "senderId" = public.current_user_id()
        AND EXISTS (
            SELECT 1 FROM "ConversationMember"
            WHERE "ConversationMember"."conversationId" = "Message"."conversationId"
            AND "ConversationMember"."userId" = public.current_user_id()
        )
    );

-- ============================================================================
-- UserPreferenceVector
-- ============================================================================
ALTER TABLE "UserPreferenceVector" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vector"
    ON "UserPreferenceVector" FOR SELECT
    USING ("userId" = public.current_user_id());

CREATE POLICY "Users can upsert own vector"
    ON "UserPreferenceVector" FOR INSERT
    WITH CHECK ("userId" = public.current_user_id());

CREATE POLICY "Users can update own vector"
    ON "UserPreferenceVector" FOR UPDATE
    USING ("userId" = public.current_user_id())
    WITH CHECK ("userId" = public.current_user_id());

-- ============================================================================
-- UserPopularity
-- ============================================================================
ALTER TABLE "UserPopularity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read popularity"
    ON "UserPopularity" FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can upsert own popularity"
    ON "UserPopularity" FOR INSERT
    WITH CHECK ("userId" = public.current_user_id());

CREATE POLICY "Users can update own popularity"
    ON "UserPopularity" FOR UPDATE
    USING ("userId" = public.current_user_id())
    WITH CHECK ("userId" = public.current_user_id());

-- ============================================================================
-- Storage policies for photos bucket
-- ============================================================================
CREATE POLICY "Public read access for photos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'photos');

CREATE POLICY "Authenticated users can upload own photos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'photos'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = (SELECT id FROM public."User" WHERE auth_id = auth.uid() LIMIT 1)
    );

CREATE POLICY "Users can delete own photos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'photos'
        AND (storage.foldername(name))[1] = (SELECT id FROM public."User" WHERE auth_id = auth.uid() LIMIT 1)
    );
