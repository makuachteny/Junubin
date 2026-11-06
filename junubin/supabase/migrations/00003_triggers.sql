-- ============================================================================
-- Triggers
-- ============================================================================

-- ============================================================================
-- handle_new_user: Auto-create User + Profile row on auth.users signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public."User" (id, auth_id, email, phone, "displayName", "updatedAt")
    VALUES (
        gen_random_uuid()::text,
        NEW.id,
        NEW.email,
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'displayName', ''),
        NOW()
    );

    -- Auto-create a Profile row for the new user
    INSERT INTO public."Profile" (id, "userId", "updatedAt")
    VALUES (
        gen_random_uuid()::text,
        (SELECT id FROM public."User" WHERE auth_id = NEW.id LIMIT 1),
        NOW()
    );

    -- Auto-create a UserPopularity row
    INSERT INTO public."UserPopularity" (id, "userId", "updatedAt")
    VALUES (
        gen_random_uuid()::text,
        (SELECT id FROM public."User" WHERE auth_id = NEW.id LIMIT 1),
        NOW()
    );

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- update_timestamp: Auto-set updatedAt on modification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_timestamp
    BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_profile_timestamp
    BEFORE UPDATE ON "Profile"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_match_timestamp
    BEFORE UPDATE ON "Match"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_conversation_timestamp
    BEFORE UPDATE ON "Conversation"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_preference_vector_timestamp
    BEFORE UPDATE ON "UserPreferenceVector"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_popularity_timestamp
    BEFORE UPDATE ON "UserPopularity"
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- ============================================================================
-- update_conversation_on_message: Bump conversation updatedAt on new message
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE "Conversation" SET "updatedAt" = NOW()
    WHERE id = NEW."conversationId";
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_message_update_conversation
    AFTER INSERT ON "Message"
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_on_message();

-- ============================================================================
-- Enable Realtime for key tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE "Message";
ALTER PUBLICATION supabase_realtime ADD TABLE "Match";
ALTER PUBLICATION supabase_realtime ADD TABLE "Conversation";
