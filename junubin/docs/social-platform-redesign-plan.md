# JuNubin Social Platform Redesign Plan

Date: 2026-07-31

## Goal

Pivot JuNubin from a dating-first app into a lean South Sudanese connection platform where people can locate, discover, follow, and message each other across the diaspora.

The new product should answer one clear question: "Where are my South Sudanese people near me or in the city I care about?"

## Research Notes

- Supabase should remain the backend for auth, database, storage, realtime, and edge functions.
- Supabase Postgres can support the lean product with the existing schema plus cleanup migrations for follows, message requests, text conversations, and location visibility.
- Supabase Realtime should be used only for text messages, message request updates, presence, and notifications.
- Google Play treats device location as personal and sensitive user data. Location collection requires clear disclosure, affirmative consent, secure handling, privacy policy coverage, Data Safety declarations, and account/data deletion.
- Apple privacy labels distinguish precise location from coarse location. Apple says latitude/longitude with three or more decimals is precise location; if precise location is immediately coarsened before storage, disclose coarse location.
- UNHCR reported 2,457,830 South Sudanese refugees and asylum-seekers as of 2026-06-30, concentrated in Uganda, Sudan, Ethiopia, Kenya, and DRC. That supports a diaspora/community discovery product with strong East Africa plus global diaspora assumptions.

Sources:

- Supabase Realtime: https://supabase.com/docs/guides/realtime
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- UNHCR South Sudan situation data: https://data.unhcr.org/en/situations/southsudan

## Current Codebase Read

This is an Expo/React Native app backed by Supabase Auth, Supabase Postgres, Supabase Storage, Realtime, and Edge Functions.

Useful pieces to keep:

- Existing React Native shell, navigation, theme, auth context, offline cache, push notifications, reporting/blocking, profile photos, text messages, follow graph, and `PeopleMap`.
- Existing `Follow` service, profile screens, chat screens, and map/discovery components. These are closer to the desired product than the swipe/match layer.
- Existing moderation, block, account-delete, Sentry, PostHog hooks, and store submission docs.

Dating pieces to remove or rewrite:

- `Swipe`, `Match`, `Likes`, `Super Like`, `Rewind`, dating intent, sexual preference, "who do you want to date", "children", match celebration, match-only chat language, match missions, "see who likes you", daily like limits, and romance-scam copy that assumes dating.
- The Home tab currently says "Connect" but is still a swipe deck. It should become a map/directory surface.
- Payment products are still built around dating mechanics: Super Likes, Spotlights, likes visibility, unlimited likes, and whispers.
- Posts, stories, reels, groups, games, and event-style community features are now out of scope and should be removed from primary navigation.
- Calls, video, live rooms, Daily.co, voice notes, and audio/video chat features are now out of scope. Chat should be text-only.

## Product Redesign

### Primary Experience

Replace the swipe deck with a location-first social home:

- Map view: nearby South Sudanese users who opted in to visibility.
- List view: the same results as cards for users who do not want a map.
- City search: find people by city, state, country, university, workplace, or community hub.
- Diaspora filters: country of residence, city, tribe/background, languages, interests, profession, school, faith/community org, arrival status, and verification.
- Activity status: online, recently active, open to meeting, open to helping.

### Connection Model

Use social graph primitives instead of dating primitives:

- Follow: one-way public connection.
- Friend: mutual follow or accepted connection request.
- Message request: a permissioned first contact path to reduce spam.
- Introductions: allow trusted mutuals to introduce two people.

### Key Screens

- Home: map/list toggle, city search, nearby people.
- Directory: searchable South Sudanese diaspora directory with privacy controls.
- Messages: text conversations and message requests.
- Profile: identity, city, background, languages, interests, "open to" badges, verification, privacy.
- Settings: location visibility, blocked users, data deletion, notification controls, privacy choices.

## Backend Direction For Supabase

Recommended target architecture:

- Mobile app: Expo/React Native.
- Auth: Supabase Auth.
- Database: Supabase Postgres.
- Storage: Supabase Storage for profile photos.
- Realtime: Supabase Realtime for text messages, message requests, presence, and notifications.
- Edge Functions: keep Supabase Edge Functions for discovery, payments, moderation, push, account delete, and any server-only logic.

Database changes:

- Create `users`, `profiles`, `locations`, `location_visibility`, `follows`, `friend_requests`, `message_requests`, `conversations`, `conversation_members`, `messages`, `reports`, `blocks`, `subscriptions`, and `payments`.
- Store raw location only when necessary and access-controlled. Public discovery should use coarse location buckets or city-level location.
- Add audit fields: `created_at`, `updated_at`, `deleted_at`, `moderation_status`, `visibility`, `last_active_at`.

Supabase changes:

- Keep `src/config/supabase.js` as the client entry point.
- Keep or simplify `discover` and `discover-nearby` Edge Functions for people finding.
- Add a message-request table/RPC or Edge Function so strangers cannot spam direct text chats.
- Remove or stop calling `daily-create-room`, call services, live room code, and voice/audio upload paths.
- Stop deploying or using call/live Edge Functions.

## Specific Code Changes To Plan

High priority removals:

- Remove `LikesScreen` from bottom tabs and replace it with `Directory`.
- Remove or hide Community, Stories, Reels, Posts, Groups, Events, Interactivity Hub, and Games routes from primary navigation.
- Remove or hide Call, live/video, Daily.co, voice-note, and audio-message routes/components/hooks from primary navigation and chat.
- Remove swipe deck from `HomeScreen`; keep `PeopleMap` and redesign it as the first-class home surface.
- Remove `ActionButtons`, `MatchCelebrationOverlay`, `HeartBurstOverlay`, `BoostPulseRing`, Super Like purchase surfaces, and dating-only profile fields.
- Rename `matchesService` to `conversationService` and decouple conversations from `Match`.
- Replace `recordSwipe()` with `followUser()`, `requestConnection()`, and `sendMessageRequest()`.
- Replace `Match` and `Swipe` tables with social graph tables, or keep legacy tables read-only during migration and stop writing to them.

High priority rewrites:

- Rewrite onboarding to ask:
  - name
  - birthdate/18+ check
  - gender optional
  - country/city
  - South Sudanese background/tribe optional
  - languages
  - interests
  - "open to": friends, business, mentorship, housing help, student network, cultural connection
  - location visibility opt-in
- Rewrite chat gating:
  - mutual friends can chat directly
  - non-friends send message requests
  - blocked/reported users cannot contact each other
  - chat is text-only
- Rewrite payments around social value, not dating advantage.

## Monetization

Avoid paywalling basic connection. The trust of the community matters more than squeezing first-contact mechanics.

Better revenue options:

- Premium member plan:
  - advanced city/diaspora filters
  - profile boost in directory
  - "open to help" priority listing
  - read receipts or enhanced inbox controls
- Business/community directory:
  - paid listings for South Sudanese-owned businesses
  - verified professional profiles
  - job/housing/roommate profile badges or directory filters
- Donations:
  - support community moderation
  - sponsor free verification for students/refugees
- Ads only if tightly controlled:
  - local South Sudanese businesses and services
  - no location-targeted ad resale or precise location sharing

Payment features to remove or replace:

- Remove Super Likes.
- Remove unlimited likes.
- Remove "see who likes you".
- Replace Spotlights with "Featured profile" or "Featured business".
- Replace Coins with credits only if they buy concrete discovery/chat utility, such as directory boosts.
- Keep Stripe and RevenueCat, but rebuild product IDs and copy so app review sees a social networking product, not dating mechanics.

## Privacy And Safety Requirements

Location must be explicit opt-in.

Required controls:

- Appear on map: off by default.
- City-only mode: show city but not map pin.
- Coarse location mode: show approximate area only.
- Temporary visibility: visible for 1 hour, 8 hours, or until manually disabled.
- Hide from specific people.
- Block, report, mute, and remove follower.
- Account deletion in-app and from a web URL.
- Clear disclosure before requesting location permission.

Implementation rule:

- Store the minimum viable location. Prefer city/geohash/coarse bucket for public discovery. Keep precise device location on-device unless a feature truly requires sending it.

## Launch Plan

Phase 1: Product pivot foundation

- Freeze dating feature development.
- Rename the product internally from dating/community to social/community.
- Replace Home swipe deck with Map/List directory.
- Replace Likes tab with Directory.
- Remove or hide posts, stories, reels, groups, events, and games.
- Update onboarding and profile fields.
- Remove dating copy from README, docs, store metadata, privacy policy, and terms.

Phase 2: Supabase cleanup

- Keep Supabase as the backend.
- Add cleanup migrations for the lean social model.
- Keep or simplify Edge Functions for profiles, nearby search, follows, message requests, text chat, reports, payments, moderation, push, and account deletion.
- Stop writing to dating tables.
- Stop deploying or calling call/video/live functions.

Phase 3: Payments

- Redesign products around premium discovery, chat utility, and featured listings.
- Remove Super Like/Super Like bundles from `products.js`, Stripe shared products, Flutterwave product maps, RevenueCat offerings, and UI.
- Set real webhook secrets and redeploy payment webhooks.
- Test every purchase grant before store submission.

Phase 4: Launch readiness

- Update app privacy labels and Google Data Safety for location, photos, messages, contacts if used, user content, payments, diagnostics, and account deletion.
- Add location consent screen before requesting permissions.
- Run full Jest suite and app smoke tests.
- Submit first as "Social Networking", not dating.
- Launch in focused cities first: Juba, Kampala, Nairobi, Kakuma/East Africa communities, Omaha, Dallas, Houston, Phoenix, Des Moines, Minneapolis, Melbourne, Calgary/Edmonton, London, and Cairo depending on known community density.

## Biggest Gaps

- The current database model is dating-centered. `Swipe`, `Match`, popularity-by-likes, and like limits are not the right foundation.
- The current Home experience is still a dating deck despite existing social filters.
- Existing chat and call code is coupled to matches.
- Chat needs to become text-only and decoupled from matches.
- Monetization is coupled to dating mechanics.
- The app has extra feed/community surfaces such as posts, stories, reels, groups, events, and games that should be removed for the lean discovery/chat product.
- The app has call/video/live/audio features that should be removed for the text-only product.
- The app already requests and uses location, but the new concept makes location central, so consent, coarse storage, and privacy UX need to be first-class.
- Existing launch docs need a full rewrite after the pivot because app category, privacy disclosures, payment SKUs, screenshots, and review narrative all change.

## Recommended First Implementation Slice

Build a non-dating MVP before attempting the whole migration:

1. Keep Supabase temporarily.
2. Remove dating mode from onboarding and navigation.
3. Make `PeopleMap` plus list search the Home tab.
4. Make Follow/Friend/Message Request the connection flow.
5. Replace Likes tab with Directory.
6. Remove posts, stories, reels, groups, events, games, calls, video, live rooms, voice notes, Super Likes, and swipe limits from UI.
7. Update copy, privacy disclosure, and store category.
8. Keep Supabase and add only the migrations/functions needed for discovery and text chat.

This avoids combining a product redesign, backend migration, auth migration, and payment rebuild into one risky release.

---

## Implementation Status — Phase 1 complete (2026-07-31)

Phase 1 (the non-dating MVP on Supabase) is implemented. Supabase remains the
backend; no Render/Postgres migration was started, per the revised direction.

### Navigation

Three tabs: **Nearby** (`HomeTab`), **Directory** (`DirectoryTab`), **Chats**
(`MessagesTab`). `LikesTab` and `CommunityTab` are gone.

Routes deliberately **not** registered — re-registering one is a product change,
not a bug fix: `Community`, `CreatePost`, `PostDetail`, `CreateStory`,
`StoriesView`, `VideoReels`, `CreateGroup`, `GroupDetail`, `InteractivityHub`,
`GameSettings`, `Call`, `Likes`, `Elite`, `Boost`.

`src/navigation/__tests__/routeTargets.test.js` fails the build if any code
navigates to an unregistered route. That test is what keeps this list honest.

### Deleted, not merely hidden

Screens: Community, StoriesView, GroupDetail, InteractivityHub, CreatePost,
PostDetail, CreateStory, CreateGroup, VideoReels, GameSettings, Call, Likes,
Elite, Boost.

Components: PostCard, StoriesRow, GameBubble/GamePickerSheet/GameResultOverlay,
Gift{Picker,Bubble,Animation}, ChatAudioBubble, VoiceRecorder,
VoicePrompt{Recorder,Player}, IncomingCallOverlay, MatchCelebrationOverlay,
HeartBurstOverlay, BoostPulseRing, SpotlightCard.

Services/hooks: callService, dailyService, likesService, postService,
commentService, storyService, useIncomingCall, useDailyCall.

Data/utils: games, gifts, postThemes, communityFilters, gameEngine, postComposer,
mockStories. Edge function `daily-create-room`.

### Backend (Supabase)

`00047_social_pivot.sql` adds `Profile.languages / openTo / profession /
locationVisibility / locationVisibleUntil / directoryVisible`, the
`MessageRequest` table with RLS, and the `accept_message_request()` RPC. A
trigger keeps the legacy `Profile.shareLocation` boolean in sync both ways so an
older client can't silently break. New `directory` Edge Function;
`discover-nearby` now filters on `locationVisibility`.

The legacy `Swipe` and `Match` tables are intentionally **not** dropped —
`matchesService` still reads `Match` to build the inbox, and
`accept_message_request()` mints a `Match` row because `Conversation.matchId` is
`NOT NULL`. Nothing writes a swipe. Decommissioning those tables is its own
migration, after the inbox is ported off `Match`.

### Monetization

**None.** The app is free end to end. `PAYMENTS_ENABLED` and `SHOW_PAYMENTS_UI`
are permanently `false`, entitlement helpers are shims returning `true`, and the
retired product IDs live in `RETIRED_PRODUCT_IDS` so historical receipts still
resolve. The Monetization section above is superseded and kept only as a record
of what was considered.

### Location privacy

Three separate concepts, deliberately not collapsed: disclosure accepted
(device flag) → OS permission → `Profile.locationVisibility` (`off` by default /
`city` / `coarse`). `PeopleMap` renders `LocationDisclosure` and will not touch
`expo-location` until consent is recorded; `city`-only members never get a map
pin. Covered by `src/screens/__tests__/discoverySurfaces.test.js`.

### Not done / next

- **Temporary visibility** (`locationVisibleUntil`) — the column and the
  server-side expiry check exist, but no UI sets it.
- **Hide from specific people** — not implemented.
- **`matchesService` → `conversationService`** rename and decoupling from
  `Match`, then dropping `Swipe`/`Match`.
- **Store metadata**: `docs/app-store-submission.md` and
  `docs/production-readiness-2026-05-27.md` still describe the dating product
  (including a 17+ "dating app" age rating). Rewrite before submitting.
- Verified-badge, saved-search and city-alert ideas are unbuilt and unfunded.
