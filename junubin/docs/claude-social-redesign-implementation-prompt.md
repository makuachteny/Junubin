# Claude Implementation Prompt: JuNubin Free Social App

You are working in this repo:

`/Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin`

Read these first:

- `AGENTS.md`
- `README.md`
- `docs/social-platform-redesign-plan.md`
- `src/navigation/AppNavigator.js`
- `src/screens/HomeScreen.js`
- `src/screens/DirectoryScreen.js`
- `src/screens/MessagesScreen.js`
- `src/screens/ProfileScreen.js`
- `src/api/services/conversationService.js`
- `src/api/services/messageRequestService.js`
- `src/api/services/followService.js`

## Objective

Maintain JuNubin as a lean, free South Sudanese social networking app where
users can locate, discover, follow, send message requests, and chat with other
South Sudanese people locally and globally.

JuNubin is 100% free. Do not add premium tiers, paid subscriptions, paid
consumables, payment setup, checkout screens, boosts, coins, paid Super Likes,
paid verification, or payment-provider launch tasks.

## Product Direction

The main user question is:

"Where are my South Sudanese people near me or in the city I care about?"

Main experiences:

- Home: location-first map/list of opted-in users.
- Directory: searchable people directory by city, country, background,
  interests, profession, school, language, activity, and verification.
- Chats: direct text conversations and message requests.
- Profile: identity, city, background, languages, interests, "open to" badges,
  photos, verification, and privacy controls.

## Hard Requirements

1. Keep the app non-dating and social-networking first.
2. Keep using Supabase for auth, database, storage, realtime, and edge functions.
3. Keep location opt-in and privacy-first.
4. Keep every feature free.
5. Do not restore payment UI or payment launch instructions.
6. Preserve auth, profile photos, follows, message requests, chat, reporting,
   blocking, account deletion, push, moderation, and PeopleMap.
7. Keep chat text-only.
8. Do not reintroduce posts, stories, reels, groups, events, games, voice calls,
   video calls, live rooms, voice notes, or audio/video chat UI.

## Acceptance Criteria

- Home opens to nearby/directory-style people discovery, not swipe cards.
- Directory filters work as discovery filters.
- Message requests and chats work end to end.
- Profile edit works end to end.
- One profile photo is enough.
- Photo verification flow is reachable and clear.
- Navigation routes are registered and deep links resolve.
- Store docs describe a free Social Networking app.
- No source or docs describe premium features as current.
- Tests pass, or failures are documented with exact causes.
