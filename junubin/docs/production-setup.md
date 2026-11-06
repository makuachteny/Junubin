# JuNubin Production Setup

JuNubin production is configured as a free social networking app. Do not set up
payment providers, paid products, subscription offerings, checkout screens, or
premium feature gates for launch.

## Required Operator Setup

1. Push database migrations.
2. Set free-app Edge Function secrets.
3. Deploy free-app Edge Functions.
4. Configure push notification trigger settings.
5. Build preview apps and run device smoke tests.
6. Submit to App Store and Google Play as a free Social Networking app.

## Database

```bash
cd /Users/makuachtenygatluak/Documents/Projects/ss_junubin/junubin
supabase link --project-ref uvtyiytbgkasemabtznc
supabase db push
```

Verify tables and columns used by profiles, directory visibility, location
visibility, follows, message requests, conversations, reports, blocks, and push
notifications.

## Edge Function Secrets

Required:

| Secret | Purpose |
|---|---|
| `NODE_ENV=production` | Enables production behavior. |
| `MODERATION_PROVIDER` | Selects image moderation provider. |
| Provider credentials | Sightengine, Google Vision, or AWS credentials for moderation/liveness. |
| `JUNUBIN_INTERNAL_SECRET` | Authenticates internal function calls from database triggers. |

Optional:

| Secret | Purpose |
|---|---|
| `SENTRY_DSN` | Edge-side error reporting. |
| `LIVENESS_PASS_THRESHOLD` | Photo verification pass threshold. |

Database settings for push notifications:

```sql
ALTER DATABASE postgres SET "app.edge_url" = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';
ALTER DATABASE postgres SET "app.service_key" = '<service-role-jwt>';
ALTER DATABASE postgres SET "app.internal_secret" = '<same value as JUNUBIN_INTERNAL_SECRET>';
```

## Edge Functions To Deploy

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

Retired/dormant payment functions are not part of production setup for the free
app. Do not treat Stripe, RevenueCat, Flutterwave, subscriptions, or paid
consumables as launch blockers.

## Verification

Run:

```bash
npm test -- --runInBand
```

Smoke test:

- OTP sign-up and session restore.
- Profile setup and edit profile.
- One-photo upload and moderation.
- Photo verification.
- Nearby and directory discovery.
- Follow/unfollow.
- Message requests.
- Accepted chats.
- Unread counts and notifications.
- Block, report, and account deletion.

## Store Submission

Set the app category to Social Networking. Mark the app as free and do not list
any in-app purchases. Store copy must not mention premium tiers, paid boosts,
paid messaging, coins, paid Super Likes, subscriptions, or paid verification.
