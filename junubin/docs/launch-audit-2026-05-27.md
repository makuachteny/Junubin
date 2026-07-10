# JuNubin — Global Launch & Money-Flow Audit

**Date:** 2026-05-27
**Audit scope:** Every piece of the app that has to be true on launch day for (a) the App Store / Play Store to accept the build, (b) real money to move from a user's card to your Stripe / RevenueCat account, and (c) the entitlement they paid for to actually land on their account.

The audit walks the entire payment pipeline — client → edge function → Stripe → webhook → Supabase RPC → `User` row — and flags every gap with the action that closes it. A separate "Launch readiness" section covers things that block the *submission*, not just the money flow.

---

## 1. CRITICAL — Money-flow blocker (fixed in this audit)

### 1.1 Consumable purchases were taking money and granting nothing

**Severity:** Hard launch blocker. Refund-risk on day one.
**Status:** ✅ Fixed in `supabase/migrations/00044_consumable_grant_service_role.sql` — needs `supabase db push`.

**What was wrong.** The `add_coins`, `add_spotlights`, `add_superlikes`, `add_whispers` RPCs (migrations 00006 / 00007) guard against impersonation with `auth.uid() IS NULL OR auth.uid() <> user_auth_id`. That check is correct for the client path (a user can only credit themselves), but the **Stripe webhook** calls these RPCs under the `service_role` JWT, where `auth.uid()` is NULL — so the guard rejected the call with *"not authorized"*.

Walking the failure end-to-end:

1. User taps "Buy 10 Spotlights" → Stripe Checkout opens → user pays.
2. `stripe-webhook` receives `checkout.session.completed`, writes a `Payment` row with `status='succeeded'` (this works — direct table write bypasses RLS under service_role).
3. Webhook calls `grantEntitlement()` → `supabase.rpc("add_spotlights", { user_auth_id, amount: 10 })`.
4. The RPC throws "not authorized".
5. Webhook returns 500. The `Payment` row is already marked succeeded.
6. Client polls the `Payment` table, sees `succeeded`, shows the "Success!" modal.
7. User reloads — spotlights balance is unchanged. They paid and got nothing.

**Why subscriptions were unaffected.** The webhook grants subscription tiers with a direct `UPDATE "User" SET subscriptionTier = ...` — that's a service_role table write, not an RPC, so it bypasses the guard entirely. Only the consumable code path was broken.

**The fix.** Migration `00044_consumable_grant_service_role.sql` rewrites the four `add_*` RPCs to bypass the user check when called by the `service_role`, while preserving the self-only rule for authenticated callers:

```sql
IF coalesce(auth.role(), '') <> 'service_role' THEN
  IF auth.uid() IS NULL OR auth.uid() <> user_auth_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
END IF;
```

**What you have to do.** From the repo root:
```bash
cd junubin
supabase db push
```
That ships migration 00044 to production. After that, the very next consumable purchase will land the credit.

**Quick verification.** In the Supabase SQL editor (logged in with the service_role context — i.e. the SQL editor), run:
```sql
SELECT public.add_coins('<any auth_id>'::uuid, 0);
```
Before the migration this throws *"not authorized"*. After, it returns the user's current balance.

---

## 2. Operator action items — these block the *first dollar moving*

These are things only you can do (paste keys, click buttons in third-party dashboards). The code is wired and waiting.

### 2.1 Set the production env vars in `eas.json` and Supabase

The production block of `eas.json` currently has only Supabase URL + anon key. For a working production build you need to add:

```jsonc
"production": {
  "env": {
    "APP_VARIANT": "production",
    "EAS_PROJECT_ID": "1cc13a52-317c-470e-addb-ef68ae3bd0e4",
    "EXPO_PUBLIC_SUPABASE_URL": "https://uvtyiytbgkasemabtznc.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_olf_AVo7BtbNDGDS4MmVbQ_FOHwyld-",

    // ▼ ADD ALL OF THESE ▼
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY":     "appl_…",       // RevenueCat dashboard → API keys
    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY": "goog_…",       // RevenueCat dashboard → API keys
    "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY":    "AIza…",        // Google Cloud → Maps SDK for Android
    "EXPO_PUBLIC_SENTRY_DSN":             "https://…",    // optional but strongly recommended
    "EXPO_PUBLIC_POSTHOG_API_KEY":        "phc_…",        // optional, for funnel analytics
    "EXPO_PUBLIC_POSTHOG_HOST":           "https://us.i.posthog.com"
  }
}
```

`app.config.js` will refuse to build production without `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (the production guard throws at config-load) — so this is hard-required for the Android build to even compile.

### 2.2 Set the Supabase Edge Function secrets (server-side)

From a terminal with `supabase` CLI linked to `uvtyiytbgkasemabtznc`:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_…
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…
supabase secrets set DAILY_API_KEY=…
supabase secrets set MODERATION_PROVIDER=sightengine   # or google
supabase secrets set SIGHTENGINE_USER=…
supabase secrets set SIGHTENGINE_SECRET=…
supabase secrets set JUNUBIN_INTERNAL_SECRET=$(openssl rand -hex 32)
supabase secrets set ENVIRONMENT=production
```

Then run these two SQL statements once in the Supabase SQL editor (they configure database-level settings the push triggers read):

```sql
ALTER DATABASE postgres SET app.edge_url    = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_key = '<paste service_role JWT>';
```

### 2.3 Register the Stripe webhook

Stripe dashboard → Developers → Webhooks → Add endpoint:

```
https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/stripe-webhook
```

Subscribe to these events:
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Copy the **signing secret** Stripe gives you into the `STRIPE_WEBHOOK_SECRET` supabase secret above. **Without that secret, the webhook rejects every event** — and the production-side guard in `stripe-webhook/index.ts` correctly returns 500 if the secret is missing or blank, so you'll see it fail loud.

### 2.4 Create the Stripe products (one-time)

Already wired — `src/payments/stripeProducts.generated.json` and `supabase/functions/_shared/stripe-products.ts` contain product/price IDs that look real (`prod_USOd…` / `price_1TTTq…`). If those are from your live account, you're good. If they're from test mode, re-run:

```bash
STRIPE_SECRET_KEY=sk_live_… node scripts/setup-stripe-products.js
```

Then commit the regenerated `stripeProducts.generated.json` and mirror the same IDs into `supabase/functions/_shared/stripe-products.ts` (Edge Functions can't import JSON cleanly, so we duplicate).

### 2.5 Create the App Store IAP products

In App Store Connect → app `6766345463` → Monetization → In-App Purchases, create one product per SKU in `src/payments/products.js`:

```
com.junubin.sub.plus.monthly      ($9.99/mo,  auto-renewable sub, group: junubin_plus)
com.junubin.sub.plus.6month       ($39.99/6mo, auto-renewable sub, group: junubin_plus)
com.junubin.sub.junub.monthly     ($19.99/mo, auto-renewable sub, group: junubin_junub)
com.junubin.sub.junub.6month      ($79.99/6mo, auto-renewable sub, group: junubin_junub)
com.junubin.spotlight.1           ($5.99,  consumable)
com.junubin.spotlight.5           ($19.99, consumable)
com.junubin.spotlight.10          ($29.99, consumable)
com.junubin.superlike.5           ($7.99,  consumable)
com.junubin.superlike.15          ($17.99, consumable)
com.junubin.superlike.30          ($29.99, consumable)
com.junubin.coins.100             ($1.99,  consumable)
com.junubin.coins.500             ($7.99,  consumable)
com.junubin.coins.1200            ($14.99, consumable)
```

App Review WILL test purchases. If any SKU is missing or doesn't match the product IDs in `products.js`, the submission is rejected with "non-functional purchase UI".

### 2.6 Create the Play Store IAP products

Google Play Console → in-app products + subscriptions. Same SKU list as 2.5. Subscriptions go under "Subscriptions", consumables under "In-app products".

### 2.7 Wire RevenueCat to both stores

RevenueCat dashboard → connect both stores (App Store Connect API key + Play Console service account JSON). Then under *Entitlements*, create:

- `plus` — attach the four `com.junubin.sub.plus.*` products (both iOS + Android SKUs).
- `junub` — attach the four `com.junubin.sub.junub.*` products.

And under *Offerings*, create `default` (the OFFERING_ID the client reads from `src/payments/products.js`).

Sanity test: do a sandbox purchase on TestFlight → watch the RevenueCat dashboard → entitlement should appear on the test user within seconds.

### 2.8 Deploy ALL migrations (the docs are stale)

`docs/production-setup.md` says to deploy through 00036, but the repo has 00037–00044 (today's fix). From `junubin/`:

```bash
supabase db push
```

This will apply 00037–00044 in order:
- 00037 per-tier swipe limits
- 00038 audit P0 hardening
- 00039 face liveness
- 00040 survey backfill
- 00041 voice prompts
- 00042 voice notes bucket
- 00043 immutable identity fields (name/DOB lock — anti-cheat)
- **00044 consumable grant service-role bypass — fixes the money bug from §1.1**

### 2.9 Deploy ALL Edge Functions

```bash
for fn in $(ls supabase/functions | grep -v ^_); do
  supabase functions deploy "$fn"
done
```

Verify each returns 401 (auth required), not 404, after deploy.

---

## 3. Global readiness — what's solid, what isn't

### 3.1 What's already global

| Area | Status | Notes |
|---|---|---|
| Subscription pricing in local currency | ✅ Automatic via RevenueCat → App Store / Play Store | The store handles FX, tax, regional pricing tiers. USD prices in `products.js` are fallbacks only. |
| Stripe Checkout language | ✅ Auto-detected from browser locale | Stripe shows the checkout in 25+ languages. |
| Apple Pay / Google Pay / Link | ✅ Enabled in Checkout | Works in every country those wallets are supported. |
| Payment Method Picker | ✅ Apple-policy compliant | iOS only sees App Store IAP; Android sees Stripe + IAP; web is Stripe-only. |
| Privacy manifests (iOS 17+) | ✅ Declared in `app.config.js` | UserDefaults, FileTimestamp, SystemBootTime, DiskSpace categories. |
| Encryption export-compliance | ✅ `ITSAppUsesNonExemptEncryption=false` | TestFlight won't prompt every build. |
| Age floor (18+) | ✅ DB constraint `User_minimum_age_chk` | Server-side, not just UI. |
| Identity immutability | ✅ Migration 00043 trigger | name/DOB locked after first set, prevents age fraud. |
| RLS coverage | ✅ Every user-writeable table | Verified across migrations 00002, 00012, 00024, 00027, 00028. |
| Crash reporting | ⚠️ Wired, awaiting DSN | `EXPO_PUBLIC_SENTRY_DSN` empty → Sentry init is a no-op. |

### 3.2 Globalization gaps to be aware of

#### 3.2.1 Stripe `automatic_tax[enabled]=true` without a tax registration
`stripe-create-checkout/index.ts` passes `automatic_tax[enabled]=true`. Stripe Tax requires you to register a tax location in the dashboard (Settings → Tax → Registrations). If you don't have at least one registration, the checkout can fail in some jurisdictions with `tax_calculation_could_not_be_performed`. **Either** add your tax registration(s) in Stripe **or** flip this flag to `false` until you do. Most non-US first-time sellers want it off for v1.

#### 3.2.2 USD-only Stripe presentment
The Stripe price IDs are single-currency USD prices. Non-US users pay USD with FX from their bank (not ideal, but works). To present prices in the buyer's currency, set up *Multi-currency prices* in Stripe and add a localized "presentment currency" call — out of scope for v1, but a clear iteration once you see geographic mix from PostHog.

#### 3.2.3 No localization (i18n) library
The app is English-only. Acceptable for a diaspora app (English is the lingua franca), but a future i18n pass would help East-African mobile-money users specifically. The `expo-localization` API is already a transitive dep — bringing in `i18n-js` later is straightforward.

#### 3.2.4 Flutterwave (East Africa mobile money) referenced but not built
`.env.example` and `00009_stripe.sql` allow `provider='flutterwave'` on Payment rows, but no edge function exists. For the South Sudanese diaspora users in Kenya / Uganda / South Sudan itself, mobile money (M-Pesa, Airtel Money) is the dominant rail. **Worth building post-launch** — Flutterwave's API is structurally identical to Stripe (checkout URL + webhook), so the lift is ~1 week of work.

#### 3.2.5 App Store / Play Store country availability
Both stores default to "All territories". You can leave it that way, OR restrict to launch markets (US, UK, AU, CA, KE, UG, SS, EG) to focus support. Choose under Pricing and Availability.

---

## 4. Other meaningful gaps (non-blocking, worth addressing)

### 4.1 Stale `assist-chat-opener` function
`docs/production-setup.md` says to delete `supabase/functions/assist-chat-opener` and `_shared/ai.ts` (the AI strategy was dropped). Both still exist in the repo. Run:

```bash
supabase functions delete assist-chat-opener
rm -rf supabase/functions/assist-chat-opener supabase/functions/_shared/ai.ts
```

### 4.2 Sentry DSN unset → silent production crashes
`App.js` gates Sentry init on `EXPO_PUBLIC_SENTRY_DSN`. Empty → no crash reporting. Highly recommended for launch: a single iPhone-specific JS crash in week 1 is invisible without it. Sign up at sentry.io (free for 5k errors/mo), paste the DSN into eas.json.

### 4.3 No funnel analytics
`EXPO_PUBLIC_POSTHOG_API_KEY` is unset. Day-1 you'll want signup → swipe → match → message → purchase funnel data to know if anything is silently leaking users between steps. Free tier covers 1M events/month — plenty.

### 4.4 Webhook only writes Payment row but skips entitlement on partial paid sessions
`stripe-webhook` checks `session.payment_status === "paid"` before granting. That's correct, but for Checkout Sessions in async-payment mode (some EU rails, bank debit, etc.) the session status can be `unpaid` → `paid` later. The renewal events (`invoice.payment_succeeded`) cover subscriptions but **a one-time consumable in async-pay mode could be stranded**. Two ways to handle it:

- Restrict `payment_method_types[0]=card` (already done) — this avoids the async rails. Good for v1.
- Add an `async_payment_succeeded` event handler for the future when you broaden payment method types.

Recommend keeping the current behavior; revisit when you broaden to bank debit / SEPA.

### 4.5 Refund / disputed-payment handling
The webhook ignores `charge.refunded` and `charge.dispute.created`. If a user disputes a charge, they retain the entitlement (subscription tier or consumable balance). Long-tail problem — worth adding a `charge.refunded` handler in the next iteration that downgrades the tier or claws back the balance. Not a launch blocker (Stripe gives you a chargeback notice you can manually resolve via the Supabase dashboard).

### 4.6 No idempotency key on Stripe API calls from the edge function
`stripe-create-checkout` doesn't pass `Idempotency-Key`. If a user double-taps "Buy", they could get two checkout sessions. Stripe will only charge them once (the second session times out), but it's hygiene worth adding. Two-line change in `stripe(...)` helper.

### 4.7 `react-native-purchases` in deps but not installed yet on dev machines
This is healthy — `PaymentService.loadRC()` dynamically `import()`s it and falls back to demo mode if not installed. Just note that the **production build must include it** (which EAS handles via the package.json dep). Verify with `eas build --profile production --platform ios --local --no-wait` that the Pods install cleanly.

---

## 5. Launch checklist (post-fixes)

Print this and tick:

- [ ] `supabase db push` (deploys 00037–00044, including the consumable-grant fix)
- [ ] `supabase functions deploy` (each function returns 401 not 404 on curl)
- [ ] Supabase secrets set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DAILY_API_KEY`, `MODERATION_PROVIDER`, `JUNUBIN_INTERNAL_SECRET`, `ENVIRONMENT=production`
- [ ] DB `ALTER DATABASE` settings: `app.edge_url`, `app.service_key`
- [ ] Stripe webhook registered → signing secret pasted into Supabase
- [ ] Stripe Tax registrations done **OR** `automatic_tax` flipped to `false`
- [ ] App Store Connect IAP products created, all 13 SKUs matching `products.js`
- [ ] Play Console IAP products created, all 13 SKUs matching
- [ ] RevenueCat: Apple + Google credentials connected, `plus` + `junub` entitlements wired, `default` offering created
- [ ] `eas.json` production env: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`
- [ ] Sandbox purchase tested end-to-end on TestFlight: Stripe sub → tier flips on User row → app shows new tier
- [ ] Sandbox purchase tested end-to-end on TestFlight: Stripe consumable → balance increments (this is the bit that was broken; 00044 fixes it)
- [ ] Sandbox purchase tested end-to-end on TestFlight: App Store sub via RevenueCat → tier flips
- [ ] `PAYMENTS_ENABLED=true`, `ALL_FEATURES_FREE=false`, `SHOW_PAYMENTS_UI=true` (already set in repo — verify before build)
- [ ] App Store Connect: App Privacy nutrition label filled, Age Rating set (17+), Description / Subtitle / Keywords pasted, screenshots uploaded
- [ ] Play Console: same metadata + content rating questionnaire complete
- [ ] Privacy policy + Terms of Service hosted at `https://junubin.app/privacy` and `https://junubin.app/terms` (the docs are in `docs/privacy-policy.md` and `docs/terms-of-service.md` — they just need a static host)
- [ ] `eas build --profile production --platform all` succeeds
- [ ] `eas submit --platform ios --profile production` (TestFlight build first, then promote to App Store)
- [ ] `eas submit --platform android --profile production`

---

## 6. Summary — what changed in this session

**Code changes shipped (1 file):**

- `supabase/migrations/00044_consumable_grant_service_role.sql` — fixes the consumable-grant authorization gap. Without this, every Stripe Spotlight / Super Like / Coin purchase charges the user but never delivers the credit. After `supabase db push`, the next purchase will work.

**Everything else in this audit is an operator task** (paste keys, create products in store dashboards, register the webhook). The code is wired and waiting. The order in §5 is the path of least resistance.
