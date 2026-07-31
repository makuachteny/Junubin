# Junubin (JuNubin)

A **social networking** app for the South Sudanese diaspora. It answers one question:
*"Where are my South Sudanese people — near me, or in the city I care about?"*

Find people on a map or in a searchable directory, follow them, and message them.
React Native (Expo) client backed by Supabase (Postgres + RLS, Auth, Storage, Realtime,
Edge Functions).

**JuNubin is free.** There is no paid tier, no consumable, and no upgrade prompt.

> **Not a dating app.** JuNubin was previously built around a swipe deck, matches,
> likes and Super Likes. That model is gone: there is no swiping, no matching, no
> likes, and no dating questions in onboarding. Connection is Follow → mutual follow,
> with a message request as the permissioned path for first contact with a stranger.
> Submit to the app stores under **Social Networking**, not Dating.

## What the app does

| Surface | Purpose |
|---|---|
| **Nearby** (Home) | Map of people who opted into location visibility, with a list fallback and city search |
| **Directory** | Searchable diaspora directory — city, country, background, language, profession, school, "open to", verification |
| **Chats** | Text conversations plus message requests from people you are not connected to |
| **Profile** | Identity, city, background, languages, interests, "open to" badges, privacy controls |

Out of scope, and deliberately unreachable: posts, stories, reels, groups, events,
games, voice calls, video calls, live rooms and voice notes. Chat is text-only.

## Tech Stack

**Client:** React Native 0.81, Expo SDK 54, React 19, React Navigation 7, Reanimated 4

**Data + auth:** Supabase (Postgres with RLS, Auth via OTP, Storage, Realtime),
Supabase Edge Functions (Deno/TypeScript). See `supabase/functions/` for the
canonical list.

**Payments:** Wired but dormant. RevenueCat and Stripe integrations remain in the
tree so that pre-existing live subscriptions keep resolving, but `PAYMENTS_ENABLED`
and `SHOW_PAYMENTS_UI` are permanently `false` and no screen offers a purchase.

## Project Structure

```text
junubin/
├── App.js                       # Entry point — fonts, auth, theme, navigation
├── src/
│   ├── api/
│   │   ├── hooks/useRealtime.js     # Supabase Realtime subscription wrapper
│   │   └── services/                # authService, chatService, connectionService,
│   │                                # directoryService, discoverService, followService,
│   │                                # matchesService (conversations), messageRequestService,
│   │                                # profileService, safetyService
│   ├── auth/AuthContext.js          # Supabase OTP auth, session resume, banned-user gate
│   ├── components/                  # PersonCard, PeopleMap, LocationDisclosure, etc.
│   ├── config/supabase.js           # Supabase client init
│   ├── data/                        # countries, tribes, languages, openTo, profileOptions
│   ├── navigation/AppNavigator.js   # 3 tabs: Nearby, Directory, Chats
│   ├── payments/                    # Dormant rails + free-for-everyone entitlement shims
│   ├── screens/
│   ├── theme/                       # Palettes, typography, responsive sizing
│   └── utils/                       # imageSource, locationConsent, offlineQueue, haptics
├── supabase/
│   ├── migrations/                  # SQL migrations (00001 → 00047)
│   ├── functions/                   # Edge Functions (Deno/TypeScript)
│   └── config.toml
├── e2e/                         # Detox specs
├── app.config.js                # Expo config (permissions, plugins, EAS)
├── eas.json                     # EAS build/submit profiles
└── assets/                      # Icons, splash, fonts
```

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli` (optional — `npx expo` works)
- Supabase CLI: `brew install supabase/tap/supabase` (for migrations)
- iOS Simulator (macOS) or Android emulator, or Expo Go on a physical device

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example file and fill in your Supabase project URL + anon key:

```bash
cp .env.example .env
```

Required client env (read at runtime via `process.env.EXPO_PUBLIC_*`):

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Settings → API) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key (Settings → API) |

Optional client env:

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_DEV_BYPASS_AUTH` | `true` to enable dev-only auth bypass on Signup |

### 3. Apply database migrations

```bash
supabase link --project-ref <your-project-ref>
SUPABASE_DB_PASSWORD='<your-db-password>' supabase db push
```

For a clean rebuild on a non-production project: `supabase db reset --linked`.

**Push migrations before deploying functions.** `00047_social_pivot.sql` adds the
`Profile.locationVisibility` / `directoryVisible` columns and the `MessageRequest`
table that the `directory` and `discover-nearby` functions select from; deploying
the functions first produces a `42703` undefined-column error.

### 4. Set Edge Function secrets (server-side only)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy \
  account-delete \
  directory discover discover-nearby trending \
  stripe-billing-portal stripe-create-checkout stripe-webhook \
  moderate-image push-send \
  detect-scam-signal face-liveness
```

> JuNubin does not use AI. `detect-scam-signal` is a deterministic regex heuristic —
> no LLM, no `AI_PROVIDER`/API keys.
>
> `daily-create-room` is retired along with voice/video calling — do not deploy it.
> `swipe` / `swipe-undo` are retired with the swipe deck; the client no longer calls
> them. Leave already-deployed copies alone until the legacy `Swipe`/`Match` tables
> are decommissioned.

Additional env vars to set with `supabase secrets set`:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` in prod — toggles fail-closed behavior in `moderate-image` |
| `MODERATION_PROVIDER` | `aws` \| `google` \| `sightengine` — required in production |
| `JUNUBIN_INTERNAL_SECRET` | Shared secret stamped by pg_net triggers on `push-send` |
| `SENTRY_DSN` | Edge-side crash reporting (optional but recommended) |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Required for `face-liveness` |
| `LIVENESS_PASS_THRESHOLD` | 0–100 (default 75) AWS Rekognition Face Liveness pass floor |

Also run, once, against your Supabase Postgres to wire pg_net → push-send:

```sql
ALTER DATABASE postgres SET "app.edge_url"        = 'https://<project-ref>.supabase.co/functions/v1';
ALTER DATABASE postgres SET "app.service_key"     = '<service-role-jwt>';
ALTER DATABASE postgres SET "app.internal_secret" = '<same value as JUNUBIN_INTERNAL_SECRET>';
```

### 6. Start the app

```bash
npm start
# Then press 'i' for iOS, 'a' for Android, or scan QR with Expo Go
```

## Testing

```bash
npm test              # Unit + component tests (Jest + jest-expo)
npm run test:watch    # Watch mode
```

### E2E (Detox)

Detox is configured for both iOS Simulator and Android Emulator using Expo prebuild.

Prerequisites: Xcode + iOS Simulator (macOS), or Android Studio + an AVD named
`Pixel_7_API_34`.

```bash
npm run e2e:build:ios     && npm run e2e:test:ios
npm run e2e:build:android && npm run e2e:test:android
```

`e2e:build:*` runs `expo prebuild` first, which generates native `ios/` and
`android/` folders. Specs live under `e2e/`.

## Architecture Notes

**Auth:** Supabase Auth with OTP (email or phone). Session is restored on cold start
via `supabase.auth.getSession()`; banned users are signed out and shown a dialog
before any UI mounts.

**Real-time:** Supabase Realtime postgres-changes subscriptions, via the `useRealtime`
hook ([src/api/hooks/useRealtime.js](src/api/hooks/useRealtime.js)) — text messages,
message-request updates, and notifications.

**Discovery:** Two Edge Functions, both service-role because the `User` SELECT policy
deliberately does not let a client browse strangers:

- `directory` — searchable people directory. Returns only users with
  `Profile.directoryVisible = true`, active and unmoderated, excluding either
  direction of a `Block`.
- `discover-nearby` — map/list of people whose `Profile.locationVisibility` is not
  `'off'`, with coordinates snapped to a coarse grid.

**Connection model:** `Follow` is the one-way primitive; a mutual follow is a
connection. `MessageRequest` (00047) is the permissioned first-contact path — a
stranger sends a request, and only on acceptance does
`accept_message_request()` mint the conversation. The legacy `Swipe` / `Match`
tables still exist and `matchesService` still reads `Match` to build the inbox, but
nothing writes a swipe any more.

**Location privacy** — three separate concepts, deliberately not collapsed:

| Concept | Stored in | Means |
|---|---|---|
| Disclosure accepted | `@junubin/location_disclosure_accepted_v1` (device) | We are allowed to ask the OS for location |
| OS permission | The operating system | We can read this device's location |
| `locationVisibility` | `Profile.locationVisibility` | What *other people* can see: `off` (default) / `city` / `coarse` |

Nothing in the app may call `Location.requestForegroundPermissionsAsync()` until
`getLocationDisclosureAccepted()` is true — Google Play requires prominent in-app
disclosure plus affirmative consent, and Apple expects the system prompt to arrive
with context. `PeopleMap` enforces this by rendering `LocationDisclosure` first.
Coordinates are bucketed to 3 decimals (~110 m) before display, city-only members
never get a map pin, and location is never sold, shared with advertisers, or used
for ad targeting. There is no background location.

**Image handling:** `imageSource()` normalizes images across the app — `require()`
numbers (local assets), URL strings (API), and `{ uri }` objects.

**Payments:** Dormant. Entitlement helpers in
[src/payments/entitlements.js](src/payments/entitlements.js) are shims that return
`true` for everyone; retired product IDs are kept in `RETIRED_PRODUCT_IDS` so
historical receipts stay resolvable.

**Storage:** Supabase Storage — `photos` (profile photos), public-read with
owner-write enforced by path-prefix RLS.

**Security:**

- Row-level security on every user-data table
- Service-role-only writes on `Payment` (clients can only read their own rows)
- HMAC-SHA256 signature verification on Stripe webhooks
- Screenshot guard on sensitive screens
- Block / report / mute / remove-follower and in-app account deletion all preserved
- `src/navigation/__tests__/routeTargets.test.js` fails the build if any code
  navigates to a route that is not registered — this is what keeps removed
  surfaces genuinely removed

## Deployment

**Database + functions:** Supabase (CLI commands above). Migrations are append-only;
never edit a migration that has already been pushed.

**iOS / Android:** EAS Build → submit. See [eas.json](eas.json).

```bash
eas build --platform ios --profile production
eas build --platform android --profile production

eas submit --platform ios --latest
eas submit --platform android --latest
```

## License

Private — all rights reserved.
