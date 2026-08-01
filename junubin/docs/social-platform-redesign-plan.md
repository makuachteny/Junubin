# JuNubin Social Platform Redesign Plan

Date: 2026-08-01

## Goal

JuNubin is a free South Sudanese social networking app. It helps people locate,
discover, follow, send message requests, and chat with other South Sudanese
people across the diaspora.

The product should answer one question:

"Where are my South Sudanese people near me or in the city I care about?"

## Product Rules

- The app is 100% free.
- There are no premium tiers.
- There are no paid subscriptions.
- There are no paid consumables.
- There are no boosts, coins, paid Super Likes, paid visibility, paid
  verification, paid messaging gates, or checkout screens.
- Stripe, RevenueCat, Flutterwave, App Store in-app purchases, and Google Play
  billing are not launch requirements.
- Any older payment material is retired historical context, not current product
  direction.

## Primary Surfaces

| Surface | Purpose |
|---|---|
| Nearby | Map/list of people who opted into location visibility. |
| Directory | Search and filter the diaspora directory. |
| Chats | Text conversations and message requests. |
| Profile | Identity, photos, verification, privacy, and settings. |

## Current Architecture Direction

- Mobile app: Expo/React Native.
- Auth: Supabase Auth.
- Database: Supabase Postgres.
- Storage: Supabase Storage for profile photos.
- Realtime: Supabase Realtime for text messages, message requests, and
  notifications.
- Edge Functions: Supabase Edge Functions for discovery, moderation, push,
  safety, and account deletion.

## Keep

- OTP auth.
- Profile setup and edit profile.
- One-photo profile support.
- Photo verification.
- PeopleMap.
- Directory filters.
- Follow graph.
- Message requests.
- Text chat.
- Notifications.
- Block, report, mute, remove follower, and account deletion.
- Location disclosure before OS permission prompt.
- Coarse/city-level location controls.

## Do Not Reintroduce

- Swipe deck.
- Likes tab.
- Match celebration.
- Super Likes.
- Rewind.
- Daily like limits.
- "See who likes you."
- Dating intentions.
- Sexuality/dating preference prompts.
- Posts, stories, reels, groups, events, games, or feeds.
- Voice calls, video calls, live rooms, voice notes, or audio/video chat.
- Premium plans, paid filters, paid visibility, paid verification, coins,
  checkout screens, subscriptions, or payment-provider setup.

## Launch Priorities

1. Keep navigation stable across tabs, deep links, and notification routes.
2. Make profile editing work end to end.
3. Make photo upload and photo verification clear and reliable.
4. Make message requests and text chat work end to end.
5. Make notifications route to the right place.
6. Keep directory and nearby discovery symmetric and responsive on different
   screen sizes.
7. Keep all documentation aligned with the free-app model.

## Launch Checklist

- [ ] `npm test -- --runInBand` passes.
- [ ] OTP sign-up works in production.
- [ ] Profile setup works.
- [ ] Edit profile persists all editable fields.
- [ ] One photo is enough to use the app.
- [ ] Photo verification can be submitted.
- [ ] Nearby discovery works after location consent.
- [ ] Directory filters work.
- [ ] Message requests can be sent, accepted, rejected, and opened.
- [ ] Chat sends and receives text messages.
- [ ] Notifications update unread state and route correctly.
- [ ] Block, report, and account deletion work.
- [ ] Store docs say JuNubin is free with no in-app purchases.

## Historical Note

Earlier planning explored paid discovery, subscriptions, Stripe, RevenueCat, and
Flutterwave. That direction is retired. Do not use those notes as implementation
or launch guidance while JuNubin remains free.
