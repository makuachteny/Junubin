# Production Readiness

> Updated for the current product direction: JuNubin is 100% free.
> Earlier paid-flow readiness notes are retired historical context and are no
> longer launch instructions.

## Verdict

JuNubin should launch as a free Social Networking app. All user-facing features
should be available without payment:

- Nearby discovery
- Directory search
- Profiles
- One-photo profile upload
- Photo verification
- Follows
- Message requests
- Chats
- Notifications
- Safety tools

There are no active premium tiers, paid consumables, subscriptions, in-app
purchases, checkout screens, paid boosts, coins, or paid Super Likes.

## Launch Requirements

| Area | Required action |
|---|---|
| Database | Push all migrations expected by the current client. |
| Edge Functions | Deploy only current free-app functions. |
| Moderation | Configure image moderation before public launch. |
| Push | Configure `push-send` trigger settings and test on real devices. |
| Auth | Verify OTP sign-up and session restore in production. |
| Store metadata | Submit as Social Networking and mark as free with no in-app purchases. |

## Free-App Function Deploy List

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

Payment functions are retired/dormant and are not production-readiness gates for
the free app.

## Smoke-Test Gate

Before submission, verify on real devices:

- OTP sign-up works.
- Profile setup and edit profile persist.
- One profile photo upload works.
- Photo verification completes or clearly explains manual/selfie review.
- Directory and nearby discovery load real data.
- Follows update correctly.
- Message requests can be sent, accepted, rejected, and opened.
- Chats send and receive text messages.
- Notifications route to the right screen.
- Block, report, and account deletion work.

## Retired Historical Note

Older versions of this document discussed Stripe, RevenueCat, Flutterwave,
subscription tiers, paid consumables, and payment webhooks. Those notes are not
current launch work. Keep them out of active checklists unless the product
direction changes away from a free app.
