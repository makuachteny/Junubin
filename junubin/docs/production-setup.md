# JuNubin — Production Setup Walkthrough

Things only you (the operator) can do. Each section has the exact command or click-path. Estimated time: ~30–45 minutes total once you have the credentials in hand.

> **Order matters:** start with #1 (Supabase migrations + secrets) because the iOS build depends on the schema and Edge Function env vars. Then #2 (RevenueCat) when you're ready to actually charge people. #3 (`discover-nearby`) is a follow-up once you have real users opted into `shareLocation`.

---

## 1. Supabase: deploy migrations + set Edge Function secrets

### 1a. Deploy the new migrations

The repo has four migrations that the latest client expects but they haven't been pushed yet:

```
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
| `STRIPE_SECRET_KEY` | stripe-create-checkout, stripe-webhook | Stripe dashboard → API keys → secret key. Use the **live** key for production, **test** key for sandbox. |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Stripe dashboard → Webhooks → your endpoint → "Signing secret". |
| `DAILY_API_KEY` | daily-create-room | Daily.co dashboard → Developers → API keys. |
| `FLW_SECRET_KEY` | flw-create-payment, flw-check-status | Flutterwave dashboard → Settings → API → Secret Key. |
| `FLW_ENCRYPTION_KEY` | flw-create-payment | Same Flutterwave settings page. |
| `app.edge_url` | push-send (DB triggers) | Set via SQL: `ALTER DATABASE postgres SET app.edge_url = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';` |
| `app.service_key` | push-send (DB triggers) | Set via SQL: `ALTER DATABASE postgres SET app.service_key = '<paste service_role key>';` (find it in Project settings → API → service_role key) |

The last two (`app.edge_url`, `app.service_key`) aren't Edge Function secrets — they're DATABASE-level settings the push triggers read via `current_setting()`. Run those two `ALTER DATABASE` statements once in the SQL editor.

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

## 3. Build a real `discover-nearby` Edge Function (optional, but PeopleMap depends on it)

Right now `src/api/services/discoverService.js:137` calls a `discover-nearby` function that doesn't exist; it returns `{ users: [] }` as a graceful fallback. PeopleMap renders demo roster pins instead. Real users will never appear on the map until this ships.

### What it needs to do

1. Authenticate the caller (`getUser()`).
2. Take `{ center: { latitude, longitude }, radiusKm, mode, activeOnly }` from the body.
3. Query `User` joined with `Profile` where:
   - `Profile.shareLocation = true` (privacy opt-in from migration 00032)
   - `Profile.appMode` matches `mode` (or both modes accept)
   - Not the caller
   - Not in any `Block` row with the caller
4. Filter by haversine distance ≤ `radiusKm` (Postgres has `<@>` operator if you install the `cube` + `earthdistance` extensions, OR do it in JS for v1).
5. Return `{ users: [{ id, name, age, photos, coords: { latitude, longitude }, activity, verified, ethnicity, mode }] }` — same shape `getNearbyUsers` already documents (see `discoverService.js:135-138`).
6. Snap coordinates to 3 decimals (~110m) on the server before returning. The client-side bucket in PeopleMap is defense-in-depth; the server is the real boundary.

### Scaffold (drop into `supabase/functions/discover-nearby/index.ts`)

I can build this for you on request — it's about 100 lines including the haversine cap, auth check, and block-filter. Just say "build discover-nearby" and I'll write it. Without earthdistance installed I'd do the distance filter in JS, which works fine up to ~1000 candidates.

### Until then

PeopleMap is functional with demo data. Tester impact: they see Adau, Akuol, etc. scattered around their location instead of real members. Not broken, just preview-mode.

---

## 4. Checklist before flipping the kill switch on prod launch

When you're ready to flip the app from preview-mode to real-launch:

- [ ] All migrations 00001–00036 applied to production Supabase (run `supabase db remote list` to verify)
- [ ] All Edge Functions deployed (`supabase functions list`)
- [ ] All Edge Function secrets set (Stripe, Daily, Flutterwave keys + `app.service_key`, `app.edge_url`)
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
