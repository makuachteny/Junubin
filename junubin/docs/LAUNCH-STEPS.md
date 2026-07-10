# JuNubin — Launch Steps (with links & exact commands)

**Your Supabase project ref:** `uvtyiytbgkasemabtznc`
**Your EAS project id:** `1cc13a52-317c-470e-addb-ef68ae3bd0e4`

This is the operator runbook. The **code is done** (270 tests pass, expo-doctor
18/18). Every step below is account/dashboard work that needs *your* logins.
Do them top to bottom — each depends on the one above. Budget ~one evening.

Legend: 🔴 blocker · 🟡 required to sell · 🟢 pre-submit

---

## 0 · One-time tooling (~10 min)

| Tool | Install / link |
|---|---|
| Supabase CLI | `brew install supabase/tap/supabase` · docs: https://supabase.com/docs/guides/cli |
| EAS CLI | `npm i -g eas-cli` then `eas login` · https://expo.dev |
| Your dashboards | Supabase https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc · Stripe https://dashboard.stripe.com · Apple https://appstoreconnect.apple.com · Google Play https://play.google.com/console · RevenueCat https://app.revenuecat.com |

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
supabase login                                   # opens browser
supabase link --project-ref uvtyiytbgkasemabtznc
```

---

## 🔴 1 · Deploy the database (~5 min)

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
supabase db push
```

Applies migrations **00037–00045**. Critically **00044** makes consumable
purchases actually credit the user (coins / Super Likes / Spotlights).
Without it, those purchases take money and grant nothing.

**Verify** — Supabase SQL Editor (https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc/sql):
```sql
-- Should return a number, not "not authorized":
SELECT public.add_coins((SELECT auth_id FROM "User" LIMIT 1), 0);
```

---

## 🔴 2 · Supabase Edge Function secrets (~10 min)

**Dashboard:** https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc/settings/functions
(or use the CLI below)

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx          # from step 3a
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx        # from step 3b
supabase secrets set MODERATION_PROVIDER=sightengine        # see step 2a
supabase secrets set SIGHTENGINE_USER=xxx
supabase secrets set SIGHTENGINE_SECRET=xxx
supabase secrets set DAILY_API_KEY=xxx                      # see step 2b
supabase secrets set JUNUBIN_INTERNAL_SECRET=$(openssl rand -hex 32)
supabase secrets set NODE_ENV=production
```

> `MODERATION_PROVIDER` is **not optional** — if unset, every photo upload
> returns 503 and the moderation fail-closed guard blocks the app. `NODE_ENV`
> (or `ENVIRONMENT`) must be `production` or that guard won't engage.

Then one-time SQL for push-notification DB triggers (SQL Editor):
```sql
ALTER DATABASE postgres SET app.edge_url    = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_key = '<service_role JWT — Settings → API>';
```
Service role key lives at: https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc/settings/api

### 2a · Sightengine (image moderation)
- Sign up: https://sightengine.com (free tier ~2k ops/mo, then ~$0.001/image)
- API user + secret: https://dashboard.sightengine.com/api-credentials

### 2b · Daily.co (voice/video calls)
- Sign up: https://dashboard.daily.co
- API key: https://dashboard.daily.co/developers

---

## 🔴 3 · Stripe (cards — your primary rail)

### 3a · Get your live secret key
https://dashboard.stripe.com/apikeys → reveal **Secret key** (`sk_live_…`) → put in step 2.
(Activate the account first if you haven't: https://dashboard.stripe.com/account/onboarding — this is where your bank details go so you actually get paid.)

### 3b · Register the webhook (~5 min)
https://dashboard.stripe.com/webhooks → **Add endpoint**
- **URL:** `https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/stripe-webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_succeeded`,
  `invoice.payment_failed`
- Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` in step 2.

### 3c · Create the Stripe products / prices
https://dashboard.stripe.com/products — create a Price for each SKU in the table
in step 6, and paste each Stripe **price id** (`price_…`) into
`supabase/functions/_shared/stripe-products.ts`. (The 4 subscriptions must be
recurring prices; the 9 consumables are one-time prices.)

### 3d · Tax decision
- Simplest for v1: leave OFF (already the default in code).
- To enable: register a location at https://dashboard.stripe.com/settings/tax
  then `supabase secrets set STRIPE_AUTOMATIC_TAX=true`.

---

## 🔴 4 · Deploy edge functions (~5 min)

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
for fn in $(ls supabase/functions | grep -v '^_'); do
  supabase functions deploy "$fn"
done
```

**Verify** (should return 401, not 404):
```bash
curl -i https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/stripe-webhook
curl -i https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/push-send
```

---

## 🔴 5 · Fill the RevenueCat keys in `eas.json`

`junubin/eas.json` → `build.production.env` currently has **placeholders**:
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY:     appl_REPLACE_BEFORE_BUILD   ← replace
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: goog_REPLACE_BEFORE_BUILD   ← replace
```
Get the real public SDK keys in step 7. (Google Maps + Supabase keys are already real.)

---

## 🟡 6 · Create In-App Purchase products (~30 min, both stores)

Create all **13 SKUs** identically in **both** stores. Prices are your USD
anchors (stores auto-localize other currencies).

| SKU | Type | USD |
|---|---|---|
| `com.junubin.sub.plus.monthly`   | auto-renewing sub | $9.99 |
| `com.junubin.sub.plus.6month`    | auto-renewing sub | $39.99 |
| `com.junubin.sub.junub.monthly`  | auto-renewing sub | $19.99 |
| `com.junubin.sub.junub.6month`   | auto-renewing sub | $79.99 |
| `com.junubin.spotlight.1`        | consumable | $5.99 |
| `com.junubin.spotlight.5`        | consumable | $19.99 |
| `com.junubin.spotlight.10`       | consumable | $29.99 |
| `com.junubin.superlike.5`        | consumable | $7.99 |
| `com.junubin.superlike.15`       | consumable | $17.99 |
| `com.junubin.superlike.30`       | consumable | $29.99 |
| `com.junubin.coins.100`          | consumable | $1.99 |
| `com.junubin.coins.500`          | consumable | $7.99 |
| `com.junubin.coins.1200`         | consumable | $14.99 |

- **App Store Connect** → your app → Monetization → In-App Purchases &
  Subscriptions: https://appstoreconnect.apple.com
  (Put the 2 Plus subs in one subscription group, the 2 Junub subs in another.)
- **Play Console** → Monetize → Products → In-app products + Subscriptions:
  https://play.google.com/console

Both stores review IAP products before they go live — submit early, do this in
parallel with step 7.

---

## 🟡 7 · Wire RevenueCat (~15 min)

Dashboard: https://app.revenuecat.com

1. **Connect stores** — Project settings → Apps:
   - Apple: App Store Connect API key (https://appstoreconnect.apple.com/access/integrations/api)
   - Google: Play service-account JSON (https://console.cloud.google.com → IAM → Service Accounts)
2. **Entitlements** (must match `src/payments/products.js`):
   - `plus` → attach the 2 Plus SKUs from both stores
   - `junub` → attach the 2 Junub SKUs from both stores
3. **Offering** `default` → add all 4 subscription SKUs as packages.
4. **API keys** (Project → API keys → *Public* app-specific keys) →
   paste iOS `appl_…` + Android `goog_…` into `eas.json` (step 5).

---

## 🟢 8 · Google Maps key hardening (5 min, optional but recommended)

Your key is set. Lock it down so it can't be abused:
https://console.cloud.google.com/google/maps-apis/credentials → restrict to your
bundle id `+` SHA-1 fingerprints, enable only "Maps SDK for Android".

---

## 🟢 9 · Sandbox purchase test — the GO/NO-GO gate (~15 min)

```bash
eas build --profile preview --platform ios
```
Install via TestFlight, then with a **sandbox tester**
(https://appstoreconnect.apple.com/access/users → Sandbox):
1. Subscribe via Stripe → tier badge flips on your profile.
2. Subscribe via App Store IAP → tier flips, RevenueCat shows the entitlement.
3. Buy a Spotlight via Stripe → balance increments *(this is the 00044 fix)*.
4. Buy Coins → balance increments.
5. Restore Purchases → tier restored.

**If any step fails, stop and fix before submitting.**

---

## 🟢 10 · Legal + store metadata (~30 min)

- Host these at public URLs (GitHub Pages works):
  - Privacy Policy → `docs/privacy-policy.md`
  - Terms of Service → `docs/terms-of-service.md`
- App Store Connect: age rating **17+**, privacy nutrition label
  (matrix in `docs/app-store-submission.md`), 6.7" screenshots (≥3),
  description, keywords.
- Play Console: same metadata + content-rating questionnaire + Data Safety
  form (declare no AD_ID — already blocked in the manifest).

---

## 🟢 11 · Build & submit (~10 min + review wait)

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
eas build --profile production --platform all
eas submit --platform ios     --profile production
eas submit --platform android --profile production
```
iOS lands in TestFlight → promote to App Store. Android → internal track → promote up.

---

## Sign-off checklist

- [ ] `supabase db push` clean (incl. 00044)
- [ ] All secrets set (Stripe, Sightengine, Daily, internal, `NODE_ENV`)
- [ ] `ALTER DATABASE … app.edge_url / app.service_key` run
- [ ] Stripe webhook registered + signing secret in Supabase
- [ ] Stripe prices created + `price_…` ids in `stripe-products.ts`
- [ ] Edge functions deployed (401 not 404)
- [ ] 13 IAP products created in **both** stores
- [ ] RevenueCat: stores connected, `plus`+`junub` entitlements, `default` offering
- [ ] Real RevenueCat keys in `eas.json`
- [ ] Sandbox: Stripe sub ✓ · Stripe consumable ✓ · IAP sub ✓ · restore ✓
- [ ] Privacy Policy + ToS hosted; store metadata filled
- [ ] `eas build --profile production --platform all` → `eas submit`
