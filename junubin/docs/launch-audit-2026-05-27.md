# Launch Audit

> Updated for the current product direction: JuNubin is 100% free.
> The former paid-flow audit is retired historical context and is not an
> operator checklist.

## Current Audit Scope

This audit is about launching a free Social Networking app:

- App Store / Play Store acceptance.
- Real user onboarding.
- Profile, directory, nearby discovery, message requests, chats, and
  notifications.
- Safety, moderation, verification, block/report, and account deletion.

Payment processing is out of scope because the app has no paid features.

## Active Launch Risks

| Risk | Fix |
|---|---|
| Photo moderation not configured | Set `MODERATION_PROVIDER` and provider credentials before public launch. |
| Photo verification copy overclaims liveness | Configure liveness or describe the flow as selfie/manual review. |
| Push triggers missing settings | Set `app.edge_url`, `app.service_key`, and `app.internal_secret` in Postgres. |
| Directory/nearby functions stale | Deploy current free-app Edge Functions after migrations. |
| Store metadata says dating or paid app | Submit as Social Networking and state that all features are free. |

## Required Validation

Run automated tests:

```bash
npm test -- --runInBand
```

Run manual device tests:

- OTP sign-up.
- Profile creation and edit profile.
- One-photo upload.
- Photo verification.
- Location disclosure and visibility controls.
- Nearby map/list.
- Directory filters.
- Follow/unfollow.
- Message requests.
- Accepted chats.
- Notifications.
- Block, report, and account deletion.

## Retired Historical Note

Older launch-audit material covered Stripe checkout, RevenueCat in-app purchases,
Flutterwave mobile money, subscription tiers, coins, Spotlights, Super Likes,
paid webhooks, and payment receipt handling. That material is retired and should
not be used as a launch task while JuNubin remains 100% free.
