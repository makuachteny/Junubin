# JuNubin Launch Steps

JuNubin is a 100% free social networking app. There are no premium tiers, paid
consumables, in-app purchases, subscriptions, Stripe checkout flows, RevenueCat
offerings, or Flutterwave payment rails required for launch.

## Current Launch Position

Use this file as the operator runbook for a free launch.

| Area | Status | Launch action |
|---|---|---|
| Database | Required | Push migrations before deploying functions. |
| Auth | Required | Verify Supabase OTP works for email/phone in production. |
| Directory and nearby discovery | Required | Deploy `directory`, `discover`, `discover-nearby`, and `trending`. |
| Chat and requests | Required | Verify message requests, accepted chats, unread counts, and push notifications. |
| Photo moderation | Required | Configure a real moderation provider before public launch. |
| Photo verification | Required if advertised | Configure liveness, or describe the flow as manual/selfie review. |
| Payments | Not used | Do not configure payment providers for v1. |

## 1. Tooling

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
supabase login
supabase link --project-ref uvtyiytbgkasemabtznc
```

Install or verify:

- Supabase CLI
- EAS CLI
- Apple Developer access
- Google Play Console access

## 2. Database

```bash
supabase db push
```

Verify the current schema includes the social pivot tables/columns used by the
client, especially profile location visibility, directory visibility, message
requests, conversations, blocks, reports, and push notification tables.

## 3. Edge Function Secrets

Set only secrets needed by the free app:

```bash
supabase secrets set NODE_ENV=production
supabase secrets set MODERATION_PROVIDER=sightengine
supabase secrets set SIGHTENGINE_USER=<value>
supabase secrets set SIGHTENGINE_SECRET=<value>
supabase secrets set JUNUBIN_INTERNAL_SECRET=<random-32-byte-hex>
```

Optional, depending on enabled services:

```bash
supabase secrets set SENTRY_DSN=<value>
supabase secrets set AWS_REGION=<value>
supabase secrets set AWS_ACCESS_KEY_ID=<value>
supabase secrets set AWS_SECRET_ACCESS_KEY=<value>
supabase secrets set LIVENESS_PASS_THRESHOLD=75
```

Wire database-triggered push notifications:

```sql
ALTER DATABASE postgres SET "app.edge_url" = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';
ALTER DATABASE postgres SET "app.service_key" = '<service-role-jwt>';
ALTER DATABASE postgres SET "app.internal_secret" = '<same value as JUNUBIN_INTERNAL_SECRET>';
```

## 4. Deploy Free-App Edge Functions

Deploy only functions the current free client uses:

```bash
supabase functions deploy account-delete
supabase functions deploy directory
supabase functions deploy discover
supabase functions deploy discover-nearby
supabase functions deploy trending
supabase functions deploy moderate-image
supabase functions deploy push-send
supabase functions deploy detect-scam-signal
supabase functions deploy face-liveness
```

Do not deploy payment functions as a launch task. Any old Stripe or Flutterwave
functions are retired/dormant historical rails and are outside the free-app
launch path.

## 5. Build Verification

```bash
npm test -- --runInBand
npm run build
```

Then run a preview build:

```bash
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

Smoke test on real devices:

- Sign up with OTP.
- Complete onboarding.
- Edit profile end to end.
- Upload one profile photo.
- Submit photo verification.
- Toggle location visibility.
- Browse nearby and directory.
- Send, accept, and reject message requests.
- Chat after request acceptance.
- Confirm unread counts and notifications.
- Block, report, and account delete.

## 6. Store Metadata

Use Social Networking as the app category. The review narrative should say:

- JuNubin is free.
- All discovery, messaging, profile, safety, and verification features are free.
- There are no in-app purchases, paid subscriptions, premium tiers, boosts,
  coins, Super Likes, paid visibility, or checkout screens.

Host current legal docs:

- `docs/privacy-policy.md`
- `docs/terms-of-service.md`

## 7. Production Submit

```bash
eas build --profile production --platform all
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## Sign-Off Checklist

- [ ] Migrations pushed.
- [ ] Free-app Edge Functions deployed.
- [ ] Moderation provider configured.
- [ ] Push trigger settings configured.
- [ ] OTP sign-up works.
- [ ] Profile edit works.
- [ ] One-photo upload works.
- [ ] Photo verification behavior matches store copy.
- [ ] Directory and nearby discovery work.
- [ ] Message requests and chat work end to end.
- [ ] Notifications work on real devices.
- [ ] No payment provider setup is listed as a launch requirement.
- [ ] Store metadata says JuNubin is free with no in-app purchases.
