# Claude Implementation Prompt: JuNubin Social Platform Redesign

You are working in this repo:

`/Users/makuachtenygatluak/Documents/Projects/ss_junubin`

Read these first:

- `AGENTS.md`
- `junubin/README.md`
- `junubin/docs/social-platform-redesign-plan.md`
- `junubin/src/navigation/AppNavigator.js`
- `junubin/src/screens/HomeScreen.js`
- `junubin/src/components/PeopleMap.js`
- `junubin/src/screens/ProfileSetupScreen.js`
- `junubin/src/api/services/discoverService.js`
- `junubin/src/api/services/followService.js`
- `junubin/src/api/services/matchesService.js`
- `junubin/src/api/services/chatService.js`
- `junubin/src/payments/products.js`
- `junubin/src/payments/entitlements.js`

## Objective

Redesign JuNubin from a dating app into a lean South Sudanese connection platform where users can locate, discover, follow, and message other South Sudanese people locally and globally.

The new product should not feel like a dating app or a content feed. Remove dating-first mechanics and extra social-media features from the visible experience. The app should focus only on finding people and chatting with them.

## Product Direction

The main user question is:

"Where are my South Sudanese people near me or in the city I care about?"

Build toward these main experiences:

- Home: location-first map/list of opted-in South Sudanese users.
- Directory: searchable people directory by city, country, background, interests, profession, school, language, and verification.
- Messages: direct messages and message requests.
- Profile: identity, city, background, languages, interests, "open to" badges, privacy controls.

## Hard Requirements

1. Remove dating as the primary product model.
2. Keep using Supabase for auth, database, storage, realtime, and edge functions. Do not add Render, a separate API server, or a separate Postgres database.
3. Location must be opt-in and privacy-first.
4. Basic connection must remain free.
5. Monetization should be social utility, not dating advantage.
6. Keep changes incremental enough that the app can still run and tests can be updated.
7. Preserve existing useful app infrastructure: Expo shell, navigation, theme, auth, profile photos, follow service, chat, reporting/blocking, account deletion, push, moderation, and PeopleMap.
8. Remove or disable posts, stories, reels, groups, events, games, and community-feed features from primary navigation and user flows.
9. Remove or disable voice calls, video calls, live rooms, Daily.co features, voice notes, and audio/video chat UI. Communication should be text-only.

## Remove Or Replace Dating Features

Remove from primary UI:

- Swipe deck
- Likes tab
- Match celebration
- Heart/romance actions
- Super Likes
- Rewind
- Daily like limits
- "See who likes you"
- Dating intentions
- Sexuality
- "Who do you want to date?"
- Children/dating family planning field
- Match-only chat language
- "Match Mission"
- Romance-scam copy that assumes dating
- Voice call features
- Video call features
- Live/video room features
- Voice notes or audio-message features

Replace with:

- Follow
- Friend or mutual follow
- Message request
- Open-to badges
- Directory visibility
- Featured profile or boosted directory visibility

## Recommended Implementation Order

### Phase 1: Non-Dating MVP On Current Backend

Do this first. Do not start with a full backend migration.

1. Update navigation:
   - Replace `LikesTab` with `DirectoryTab`.
   - Remove or hide `CommunityTab`.
   - Keep `MessagesTab`.
   - Make Home mean "people near me / people directory", not swipe deck.
   - Remove or hide routes for Stories, Video Reels, Create Post, Post Detail, Create Story, Create Group, Group Detail, Interactivity Hub, and Game Settings unless they are still needed by tests during migration.

2. Rewrite Home:
   - Remove the swipe deck as the default experience.
   - Promote `PeopleMap` to the primary Home experience.
   - Add a list/directory fallback for users who deny location or prefer browsing.
   - Add city search and filter UI if feasible.

3. Rewrite onboarding:
   - Keep: name, date of birth/18+, gender optional, country, city, ethnicity/background optional, photos, interests.
   - Add: languages, profession/school optional, "open to" badges.
   - Add: location visibility opt-in step.
   - Remove dating-only steps.

4. Rewrite connection flow:
   - Use `followService.followUser()` for first connection.
   - Add or scaffold `messageRequestService`.
   - Stop depending on `recordSwipe()` for normal user connection.
   - Rename user-facing "matches" copy to "connections" or "friends".

5. Rewrite chat:
   - Text can start from accepted message request or mutual connection.
   - Replace "Unmatch" with "Remove connection" or "Block".
   - Remove voice/video call buttons, call routes, incoming call overlays, Daily.co hooks, call services, and voice-note UI from reachable screens.
   - Keep chat text-only for the MVP.

6. Rewrite payments UI:
   - Hide/remove Super Likes, unlimited likes, and see-likes monetization.
   - Keep payments only where they map to people discovery or chat utility.

7. Update docs/copy:
   - README should say South Sudanese people discovery and chat platform, not dating app.
   - Store launch docs should be updated later after product flows are stable.

### Phase 2: Supabase Schema And Service Cleanup

After Phase 1 is working, clean up the Supabase schema and services:

1. Keep Supabase Auth and the existing Supabase client in `src/config/supabase.js`.
2. Keep Supabase Storage for profile photos.
3. Keep Supabase Realtime only for text messages, message requests, presence, and notifications.
4. Add Supabase migrations for:
   - profile discovery fields
   - location visibility
   - follows/friends
   - message requests
   - text-only conversations
   - reports
   - blocks
   - subscriptions/payments if still needed
5. Stop writing new data to dating tables such as `Swipe` and `Match`.
6. Stop deploying or calling call/live functions such as `daily-create-room`.
7. Keep or update `discover-nearby` and `discover` Supabase Edge Functions for people discovery.
8. Keep Stripe/RevenueCat only if paid discovery features remain.

## Privacy And Safety Requirements

Implement or preserve:

- Location visibility off by default.
- Clear disclosure before requesting location permission.
- Coarse public location, not precise apartment-level location.
- City-only mode.
- Temporary visibility option if feasible.
- Block, report, mute, and remove follower.
- Account deletion.
- No precise location resale or ad targeting.
- No background location unless explicitly added with separate disclosure.

Important: Apple treats latitude/longitude with three or more decimals as precise location. Google Play requires prominent in-app disclosure and affirmative consent for sensitive data like location.

## Monetization Requirements

Do not monetize basic connection.

Preferred paid features:

- Premium directory filters.
- Featured profile.
- Boosted directory visibility.
- More saved searches or city alerts.
- Optional verified badge processing fee if policy-compliant.
- Donations/community sponsorship.

Remove or deprecate:

- Super Like products.
- Unlimited like tier benefits.
- See-who-likes-you.
- Dating boosts.

## Acceptance Criteria

The implementation is acceptable when:

- The app no longer presents itself as dating-first on the main screens.
- New users are not asked dating questions during onboarding.
- The Home tab opens to people discovery/map/list, not swipe cards.
- Likes tab is removed or replaced.
- Posts, stories, reels, groups, events, and games are not reachable from primary navigation.
- Voice calls, video calls, live rooms, voice notes, and audio/video chat controls are not reachable from primary navigation or chat screens.
- Users can follow/connect without swiping.
- Chat language says connection/friend, not match.
- Chat is text-only.
- Payments no longer advertise dating mechanics.
- Tests are updated for changed navigation and onboarding.
- `npm test` passes, or failures are documented with exact causes.
- No secrets are committed.
- Location permission has an in-app explanation before the OS permission prompt.

## Implementation Notes

- Use existing project patterns and components before adding new frameworks.
- Keep edits scoped and incremental.
- Do not delete backend tables immediately if the app still depends on them. First stop writing to dating tables and migrate UI flows away from them.
- Keep Supabase as the backend. Do not introduce Render/Postgres migration work.
- Preserve user safety and moderation flows.
- Update tests alongside behavior changes.
