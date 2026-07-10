# JuNubin — Production Setup Walkthrough

> ⚠️ **SUPERSEDED — 2026-05-27.**
> This document only covers migrations through `00036` and is missing
> the operator steps for `00037`–`00044` (in particular the consumable
> credit fix in `00044`). Use **[production-readiness-2026-05-27.md](./production-readiness-2026-05-27.md)**
> as the single source of truth for launch. Sections below are kept for
> historical context only.

Things only you (the operator) can do. Each section has the exact command or click-path. Estimated time: ~30–45 minutes total once you have the credentials in hand.

> **Order matters:** start with #1 (Supabase migrations + secrets) because the iOS build depends on the schema and Edge Function env vars. Then #2 (RevenueCat) when you're ready to actually charge people. #3 (`discover-nearby`) is a follow-up once you have real users opted into `shareLocation`.

---

## 1. Supabase: deploy migrations + set Edge Function secrets

### 1a. Deploy the new migrations

The repo has four migrations that the latest client expects but they haven't been pushed yet:

```text
00033_audit_hardening.sql           — RLS: Block check on message INSERT, report dedupe, post visibility
00034_post_waves.sql                 — PostWave table + Post.waveCount trigger
00035_post_reaction_pushes.sql      — Push notifications on like/comment/repost/wave
00036_post_quotes.sql                — Post.quotedPostId FK for LinkedIn-style reposts
```

**Run from the project root:**

```bash
cd /Users/makuachtenygatluak/Documents/ss_junubin/junubin
supabase link --project-ref uvtyiytbgkasemabtznc   # one-time, if not linked
supabase db push
```

You'll be prompted for the DB password. Migrations apply in numeric order and are idempotent — safe to re-run.

**Verify in the Supabase dashboard:**

- Table Editor → confirm `PostWave` exists, `Post` has `waveCount` and `quotedPostId` columns
- Database → Triggers → confirm `PostLike_push`, `PostComment_push`, `PostRepost_push`, `PostWave_push`, `PostWave_inc`, `PostWave_dec` are all present

If any migration fails: read the error in the CLI, fix in the SQL file, re-run. The contents are designed to be idempotent (uses `IF NOT EXISTS` / `DROP POLICY IF EXISTS` etc.).

### 1b. Set Edge Function secrets

Go to **Supabase dashboard → Project settings → Edge Functions → Secrets**. Add (or verify) these:

| Secret | Used by | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | stripe-create-checkout, stripe-webhook, stripe-billing-portal | Stripe dashboard → API keys → secret key. Use the **live** key for production, **test** key for sandbox. |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Stripe dashboard → Webhooks → your endpoint → "Signing secret". |
| `DAILY_API_KEY` | daily-create-room | Daily.co dashboard → Developers → API keys. |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` + `AWS_REGION` | face-liveness (when `EXPO_PUBLIC_LIVENESS_PROVIDER=aws-amplify`) | AWS IAM → create a user with the `AmazonRekognitionFullAccess` policy scoped to `*:rekognition:face-liveness:*` actions. Skip these if you're shipping without AWS Liveness (the photo-verify screen still works in stub mode). |
| `GOOGLE_VISION_API_KEY` | moderate-image (when `MODERATION_PROVIDER=google`) | Google Cloud Console → Vision API → enable + create API key. |
| `SIGHTENGINE_USER` + `SIGHTENGINE_SECRET` | moderate-image (when `MODERATION_PROVIDER=sightengine`) | sightengine.com → Account → API User + Secret. |
| `MODERATION_PROVIDER` | moderate-image | `google` \| `sightengine` \| `none`. `none` short-circuits to allow-all — DO NOT ship to production with `none`. |
| `LIVENESS_PASS_THRESHOLD` | face-liveness | Optional. Defaults to `0.85`. Float between 0–1; lower is more permissive. |
| `SENTRY_DSN` + `SENTRY_RELEASE` | shared `_shared/sentry.ts` | sentry.io → JuNubin project → Settings → Client Keys (DSN). `SENTRY_RELEASE` is optional and pairs with sourcemap uploads. |
| `JUNUBIN_INTERNAL_SECRET` | shared utilities for cross-function auth | Generate a random 32-byte hex string (`openssl rand -hex 32`). Used so one function can call another without forging end-user JWTs. |
| `ENVIRONMENT` | shared | `production` \| `staging` \| `development`. Drives Sentry environment tag + log verbosity. Set to `production` for the live project. |
| `app.edge_url` | push-send (DB triggers) | Set via SQL: `ALTER DATABASE postgres SET app.edge_url = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';` |
| `app.service_key` | push-send (DB triggers) | Set via SQL: `ALTER DATABASE postgres SET app.service_key = '<paste service_role key>';` (find it in Project settings → API → service_role key) |

The last two (`app.edge_url`, `app.service_key`) aren't Edge Function secrets — they're DATABASE-level settings the push triggers read via `current_setting()`. Run those two `ALTER DATABASE` statements once in the SQL editor.

**Minimum viable set for v1 launch:** `STRIPE_*` (2), `DAILY_API_KEY`, `MODERATION_PROVIDER=sightengine` + `SIGHTENGINE_*` (or `google` + `GOOGLE_VISION_API_KEY`), `EXPO_PUBLIC_LIVENESS_PROVIDER=none` (skips AWS), `app.edge_url`, `app.service_key`. The rest are opt-in features.

> **No AI:** JuNubin does not use AI/LLMs. The `assist-chat-opener` function was removed and `detect-scam-signal` is a deterministic regex heuristic, so there are no `AI_PROVIDER` / `ANTHROPIC_*` / `OPENAI_*` secrets to set. Delete `supabase/functions/assist-chat-opener` and `supabase/functions/_shared/ai.ts` from the repo and undeploy the old function (`supabase functions delete assist-chat-opener`).

**Heads up on the service_role key:** it bypasses RLS. Treat it like a master password. Don't ever commit it to git.

### 1c. Verify the function endpoints are reachable

After deploys, from a terminal:

```bash
# Should return a 401 (auth required), NOT a 404. 404 = function not deployed.
curl -i https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/push-send
```

If any function returns 404, deploy it manually:

```bash
supabase functions deploy push-send
supabase functions deploy moderate-image
supabase functions deploy swipe
# etc — repeat for each function in supabase/functions/
```

**Full deploy list:** `account-delete`, `daily-create-room`, `detect-scam-signal`, `discover`, `discover-nearby`, `face-liveness`, `moderate-image`, `push-send`, `stripe-billing-portal`, `stripe-create-checkout`, `stripe-webhook`, `swipe`, `swipe-undo`, `trending`. (`assist-chat-opener` was removed — JuNubin uses no AI.)

Worth confirming after a sync:

- `stripe-billing-portal` — added in the payment-rail audit; powers Settings → Manage Subscription for Stripe subscribers (falls back to App Store / Play Store URLs for IAP subscribers).
- `detect-scam-signal` — romance-scam safety banner. Deterministic regex heuristic (no AI), no extra secrets needed.

To deploy everything in one shot:

```bash
for fn in $(ls supabase/functions | grep -v ^_); do
  supabase functions deploy "$fn"
done
```

---

## 2. RevenueCat keys → eas.json

Without these, the in-app purchase rail falls back to demo mode and live subscriptions can't happen. Currently safe to defer because `ALL_FEATURES_FREE=true` (every premium feature is unlocked anyway), but you'll want them set before flipping payments on.

### 2a. Get the keys

1. Sign in to **RevenueCat dashboard** → Project → API keys.
2. Find the two **public** SDK keys (one per platform). They look like `appl_xxxx...` (iOS) and `goog_xxxx...` (Android).
3. **Don't** use the secret API key — only the public SDK keys go in the client bundle.

### 2b. Add to eas.json

Open `/Users/makuachtenygatluak/Documents/ss_junubin/junubin/eas.json` and edit the `production` build profile's `env` block:

```jsonc
"production": {
  "autoIncrement": true,
  "channel": "production",
  "env": {
    "APP_VARIANT": "production",
    "EAS_PROJECT_ID": "1cc13a52-317c-470e-addb-ef68ae3bd0e4",
    "EXPO_PUBLIC_SUPABASE_URL": "https://uvtyiytbgkasemabtznc.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_olf_AVo7BtbNDGDS4MmVbQ_FOHwyld-",
    // ▼ ADD THESE TWO LINES ▼
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY":     "appl_PASTE_YOUR_IOS_KEY_HERE",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "goog_PASTE_YOUR_ANDROID_KEY_HERE"
  }
}
```

The `EXPO_PUBLIC_` prefix is required — Expo only inlines env vars that start with it. They're safe in the client bundle because they're SDK keys, not secret keys.

### 2c. Flip the payment flags

Once the keys are in and you've verified a sandbox purchase actually completes end-to-end (RevenueCat's sandbox testing docs walk through this), update three constants:

**`src/payments/comingSoon.js`**

```js
export const PAYMENTS_ENABLED = true;  // was false
```

**`src/payments/entitlements.js`**

```js
export const ALL_FEATURES_FREE = false;  // was true
```

`SHOW_PAYMENTS_UI` can stay `true`.

Then cut a new build and submit. **Important: Apple App Review tests purchases.** If the live key isn't actually wired up correctly, your submission gets rejected with a "non-functional purchase UI" rejection. Test in TestFlight first.

---

## 3. Deploy the `discover-nearby` Edge Function

✅ The function is shipped in `supabase/functions/discover-nearby/index.ts` and the client is wired (PeopleMap auto-hides demo pins the moment real opted-in users come back from the function).

**Deploy:**

```bash
supabase functions deploy discover-nearby
```

That's it — no extra secrets needed; it uses the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars Supabase injects automatically into every function.

**What it does:**

1. Auth-gates via JWT (returns 401 if no caller).
2. Reads `{ center, radiusKm, mode, activeOnly }` from the body.
3. Queries `User` × `Profile` joined on:
   - `User.isActive = true`
   - `Profile.shareLocation = true` (the privacy opt-in from 00032 — the only way to appear on the map)
   - `Profile.incognito = false`, `Profile.showMe = true`
   - Mode match against `appMode` (or mapped `accountPurpose`)
   - Not the caller
   - Not in any `Block` row with the caller (symmetric — either direction)
4. Haversine distance cap in JS (clamped 0.1km–500km, default 50km).
5. Snaps coordinates to 3 decimals (~110m precision) BEFORE returning so the wire never carries the raw lat/lng.
6. Sorts by distance ascending and caps at 200 results.

**Verify after deploy:**

```bash
# Should return 401 (auth required), not 404.
curl -i https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/discover-nearby
```

**Tester impact before vs after deploy:**

- Before: PeopleMap shows DEMO_ROSTER pins (Adau, Akuol, etc.) around the caller — preview-mode.
- After: PeopleMap shows real users who opted into "Appear on map" in Settings, with demo pins falling away the moment one real user is in range.

---

## 4. Checklist before flipping the kill switch on prod launch

When you're ready to flip the app from preview-mode to real-launch:

- [ ] All migrations 00001–00036 applied to production Supabase (run `supabase db remote list` to verify)
- [ ] All Edge Functions deployed (`supabase functions list`)
- [ ] All Edge Function secrets set (Stripe, Daily + `app.service_key`, `app.edge_url`)
- [ ] RevenueCat keys in `eas.json` production env
- [ ] Sandbox purchase verified end-to-end (RevenueCat → Stripe → Supabase webhook → User row tier update)
- [ ] `PAYMENTS_ENABLED = true`, `ALL_FEATURES_FREE = false`
- [ ] `DEMO_DATA_ENABLED = true` is fine — the v1.0.3 client auto-hides demo as real data appears; new users still get a populated empty state
- [ ] Push notification certificate uploaded in Apple Developer (APNs)
- [ ] Expo push notifications tested on a real device (not Expo Go — needs a dev/preview/prod build)
- [ ] Apple Developer Account: in-app purchase products created and matching the SKUs in `src/payments/products.js`
- [ ] Privacy nutrition label filled out in App Store Connect (the audit confirmed our permission strings are clean, but the nutrition label is a separate App Store Connect form)

---

**Questions or stuck on a step?** Tell me which section and I'll walk you through it line-by-line.
