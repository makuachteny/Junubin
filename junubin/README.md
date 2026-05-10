# Junubin (JuNubin)

A dating + community app built for the South Sudanese diaspora. React Native (Expo) client backed by Supabase (Postgres + RLS, Auth, Storage, Realtime, Edge Functions).

## Tech Stack

**Client:** React Native 0.81, Expo SDK 54, React 19, React Navigation 7, Reanimated 4

**Data + auth:** Supabase (Postgres with RLS, Auth via OTP, Storage, Realtime), Supabase Edge Functions (Deno/TypeScript) for `discover`, `swipe`, `stripe-webhook`, `flw-*`, `moderate-image`, `push-send`, `event-ticket-pkpass`

**Payments:** RevenueCat (App Store / Google Play), Stripe (web), Flutterwave (African mobile money / cards)

**Real-time media:** Daily.co (voice/video calls + live)

## Project Structure

```text
junubin/
├── App.js                       # Entry point — fonts, auth, theme, navigation
├── src/
│   ├── api/
│   │   ├── hooks/
│   │   │   ├── useRealtime.js   # Supabase Realtime subscription wrapper
│   │   │   ├── useIncomingCall.js
│   │   │   ├── useLiveChannel.js
│   │   │   └── useDailyCall.js
│   │   └── services/            # profileService, discoverService, chatService,
│   │                            # postService, commentService, storyService,
│   │                            # likesService, matchesService, followService,
│   │                            # callService, liveService, safetyService
│   ├── auth/AuthContext.js      # Supabase OTP auth, session resume, banned-user gate
│   ├── components/              # ProfileCard, PostCard, StoriesRow, etc.
│   ├── config/supabase.js       # Supabase client init
│   ├── data/
│   │   ├── mockProfiles.js      # Seed/fallback content for empty DBs and dev
│   │   └── mockStories.js
│   ├── navigation/AppNavigator.js
│   ├── payments/                # SubscriptionContext, RevenueCat, Flutterwave
│   ├── screens/                 # 38 screens (Home, Community, Messages, Chat, etc.)
│   ├── theme/                   # Palettes, typography, responsive sizing
│   └── utils/                   # imageSource, formatTime, offlineQueue, haptics
├── supabase/
│   ├── migrations/              # 17 SQL migrations (00001 → 00017)
│   ├── functions/               # Edge Functions (Deno/TypeScript)
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

Stripe + Flutterwave webhooks need secrets that must NOT be in the client:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set FLUTTERWAVE_SECRET_KEY=FLWSECK-...
supabase secrets set FLUTTERWAVE_WEBHOOK_SECRET=...
supabase secrets set FLUTTERWAVE_REDIRECT_URL=https://yourdomain/payment/callback
```

### 5. Deploy Edge Functions

```bash
supabase functions deploy discover swipe swipe-undo \
  stripe-webhook flw-create-payment flw-check-status flw-webhook \
  moderate-image push-send event-ticket-pkpass
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

**Payments:** RevenueCat for in-app purchases (App Store / Google Play), Stripe for web checkout, Flutterwave for African mobile money + cards. All providers write to a single `Payment` table keyed on `(provider, providerRef)` for idempotency. Entitlement grants happen only after the webhook re-verifies the transaction directly with the provider's API.

**Storage:** Supabase Storage buckets — `photos` (profile photos), `posts` (community feed images), `stories` (24h ephemeral). All public-read with owner-write enforced by path-prefix RLS.

**Security:**

- Row-level security on every user-data table
- Service-role-only writes on `Payment` (clients can only read their own rows)
- HMAC-SHA256 signature verification on Stripe webhooks; constant-time `verif-hash` comparison on Flutterwave webhooks
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
