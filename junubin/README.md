# Junubin (JuNubin)

A dating + community app built for the South Sudanese diaspora. React Native (Expo) client backed by Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions).

## Tech Stack

**Client:** React Native 0.81, Expo SDK 54, React 19, React Navigation 7, Reanimated 4

**Data + auth:** Supabase (Postgres with RLS, Auth via OTP, Storage, Realtime), Supabase Edge Functions (Deno/TypeScript). See `supabase/functions/` for the canonical list. Current functions:
`account-delete`, `daily-create-room`, `detect-scam-signal` (regex heuristic — no AI), `discover`, `discover-nearby`, `face-liveness` (scaffold), `moderate-image`, `push-send`, `stripe-billing-portal`, `stripe-create-checkout`, `stripe-webhook`, `swipe`, `swipe-undo`, `trending`.

**Payments:** RevenueCat (App Store / Google Play), Stripe (web — cards, Apple Pay, Google Pay, Link)

**Real-time media:** Daily.co (voice/video calls + live)

## Project Structure

```text
junubin/
├── App.js                       # Entry point — fonts, auth, theme, navigation
├── src/
│   ├── api/
│   │   ├── hooks/
│   │   │   ├── useRealtime.js       # Supabase Realtime subscription wrapper
│   │   │   ├── useIncomingCall.js
│   │   │   └── useDailyCall.js      # Daily.co voice/video + live-broadcast rooms
│   │   └── services/                # authService, callService, chatService,
│   │                                # commentService, dailyService, discoverService,
│   │                                # followService, likesService, matchesService,
│   │                                # postService, profileService, safetyService,
│   │                                # storyService  (13 services)
│   ├── auth/AuthContext.js          # Supabase OTP auth, session resume, banned-user gate
│   ├── components/                  # ProfileCard, PostCard, StoriesRow, LivenessPromptOverlay, etc.
│   ├── config/supabase.js           # Supabase client init
│   ├── data/
│   │   ├── countries.js, tribes.js, culturalStickers.js, games.js, gifts.js, postThemes.js
│   │   └── __dev__/                 # mockProfiles, mockStories — stripped from prod bundle
│   ├── navigation/AppNavigator.js
│   ├── payments/                    # SubscriptionContext, RevenueCat, Stripe, entitlements
│   ├── screens/                     # 35 screens (Home, Community, Messages, Chat, etc.)
│   ├── theme/                       # Palettes, typography, responsive sizing
│   └── utils/                       # imageSource, formatTime, offlineQueue, haptics
├── supabase/
│   ├── migrations/                  # 30+ SQL migrations (00001 → 00039)
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
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat iOS public SDK key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public SDK key |
| `EXPO_PUBLIC_DEV_BYPASS_AUTH` | `true` to enable dev-only auth bypass on Signup |

### 3. Apply database migrations

Link your Supabase project and push the schema:

```bash
supabase link --project-ref <your-project-ref>
SUPABASE_DB_PASSWORD='<your-db-password>' supabase db push
```

For a clean rebuild on a non-production project: `supabase db reset --linked`.

### 4. Set Edge Function secrets (server-side only)

The Stripe webhook needs secrets that must NOT be in the client:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy \
  account-delete daily-create-room \
  discover discover-nearby swipe swipe-undo trending \
  stripe-billing-portal stripe-create-checkout stripe-webhook \
  moderate-image push-send \
  detect-scam-signal face-liveness
```

> JuNubin does not use AI. The old `assist-chat-opener` function is
> retired (don't deploy it) and `detect-scam-signal` is now a
> deterministic regex heuristic — no LLM, no `AI_PROVIDER`/API keys.

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
# Unit + component tests (Jest + jest-expo)
npm test

# Watch mode
npm run test:watch
```

### E2E (Detox)

Detox is configured for both iOS Simulator and Android Emulator using Expo prebuild.

Prerequisites:

- Xcode + iOS Simulator (macOS) for iOS tests
- Android Studio + running AVD named `Pixel_7_API_34` for Android tests

Commands:

```bash
# iOS
npm run e2e:build:ios
npm run e2e:test:ios

# Android
npm run e2e:build:android
npm run e2e:test:android
```

`e2e:build:*` runs `expo prebuild` first, which generates native `ios/` and `android/` folders. E2E specs live under `e2e/` with a starter smoke test in `e2e/smoke.e2e.js`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm test` | Run unit + component tests |
| `npm run test:watch` | Jest watch mode |
| `npm run e2e:build:ios` | Prebuild + compile iOS app for Detox |
| `npm run e2e:test:ios` | Run Detox tests on iOS simulator |
| `npm run e2e:build:android` | Prebuild + compile Android app for Detox |
| `npm run e2e:test:android` | Run Detox tests on Android emulator |
| `supabase db push` | Apply pending migrations to the linked project |
| `supabase functions deploy <name>` | Deploy an Edge Function |

## Architecture Notes

**Auth:** Supabase Auth with OTP (email or phone). Session is restored on cold start via `supabase.auth.getSession()`; banned users are signed out and shown a dialog before any UI mounts.

**Real-time:** Supabase Realtime postgres-changes subscriptions. The `useRealtime` hook ([src/api/hooks/useRealtime.js](src/api/hooks/useRealtime.js)) is the entry point — chat messages, match notifications, post counter updates, and live-stream join requests all flow through it.

**Discovery + matching:** The `discover` Edge Function ([supabase/functions/discover/](supabase/functions/discover/)) ranks candidates using ethnic affinity, sticker overlap, interest clusters, and distance, with spotlight + incognito honored server-side. The `swipe` function records the swipe and creates a Match if mutual.

**Image handling:** The `imageSource()` utility normalizes images across the app — handles `require()` numbers (local assets), URL strings (API), and `{ uri }` objects.

**Subscription tiers:** Free → Plus → Junub. Entitlements checked via pure functions in [src/payments/entitlements.js](src/payments/entitlements.js).

**Payments:** RevenueCat for in-app purchases (App Store / Google Play) and Stripe for web checkout. Both providers write to a single `Payment` table keyed on `(provider, providerRef)` for idempotency. Entitlement grants happen only after the webhook re-verifies the transaction directly with the provider's API.

**Storage:** Supabase Storage buckets — `photos` (profile photos), `posts` (community feed images), `stories` (24h ephemeral). All public-read with owner-write enforced by path-prefix RLS.

**Security:**

- Row-level security on every user-data table
- Service-role-only writes on `Payment` (clients can only read their own rows)
- HMAC-SHA256 signature verification on Stripe webhooks
- Screenshot guard on sensitive screens
- Survey + moderation eligibility check enforced both client-side and server-side via the `eligibility_check` RPC

## Deployment

**Database + functions:** Supabase (CLI commands above). Migrations are append-only; never edit a migration that's already been pushed.

**iOS / Android:** EAS Build → submit. See [eas.json](eas.json).

```bash
# Build for TestFlight + Internal Testing
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios --latest
eas submit --platform android --latest
```

## License

Private — all rights reserved.
