# JuNubin — Launch Readiness & Next Steps

**Date:** 2026-08-01
**Method:** verified against the code in this repo, not against the older audit
docs (several of which still describe the deleted payments stack). Anything I
could not verify from the repo is called out explicitly in the last section.
**Build state at time of writing:** 38 Jest suites / 288 tests passing; iOS
production bundle exports clean (`npx expo export --platform ios`).

Supersedes the status tables in `launch-audit-2026-05-27.md` and
`production-readiness-2026-05-27.md`. `LAUNCH-STEPS.md` remains the operator
runbook for *how* to run each command; this file is *what is left and in what
order*. One correction to that runbook: do **not** deploy `discover` — it was
retired and now returns 410. The live discovery surfaces are `directory` and
`discover-nearby`.

---

## Verdict

The application is in good shape. What stands between you and users is
infrastructure and account setup, not code. Two items below mean that today
nobody can sign up, and App Review would reject on first contact.

| Area | State | Blocking? |
|---|---|---|
| App code, navigation, chat, directory, map | Working, tested | No |
| Safety: block, report, unmatch, 18+ gate, EULA, hard delete | Implemented | No |
| Photo moderation enforcement | Implemented, **not deployed** | Yes — deploy |
| Phone OTP signup | Needs an SMS provider | **Yes** |
| `junubin.app` domain | Does not resolve (NXDOMAIN) | **Yes** |
| Backend deployment (migrations + functions) | Unverified | **Yes** |
| Seed content | Generated, not applied | Yes — empty app |
| Crash reporting / analytics | Keys absent | No, but you'd be blind |
| Rate limiting | None anywhere | No — pre-scale risk |

---

## Critical path

Do these in order. 1 and 2 can run in parallel; 3 gates 4.

### 1. SMS provider — nobody can sign up without it

`src/auth/AuthContext.js` calls `supabase.auth.signInWithOtp({ phone })`. That
needs a provider configured in **Supabase → Authentication → Providers → Phone**
(Twilio, MessageBird or Vonage credentials).

There is no env var for this and no code change that substitutes for it. Until
it is configured every real signup fails at the six-digit step. The dev bypass
in `src/config/devAuth.js` is double-gated behind `__DEV__`, so no TestFlight or
App Store binary can reach it — by design, and it should stay that way.

Budget for real SMS cost per signup, and set a spend cap on the provider before
launch. OTP endpoints are a standard target for toll-fraud.

### 2. Register and host `junubin.app`

I checked: `junubin.app` and `www.junubin.app` are both **NXDOMAIN**. The domain
is load-bearing in four places:

- privacy-policy and support URLs App Review will follow (rejection if dead)
- universal-link prefix in `App.js` (`https://junubin.app`)
- `support@junubin.app`, the support address in the Terms copy in
  `src/screens/SettingsInfoScreen.js`
- the delete-account instructions page Apple requires to be publicly reachable

The pages are already written and sitting in `website/` — `privacy.html`,
`terms.html`, `support.html`, `safety.html`, `guidelines.html`,
`delete-account.html`. They need a domain and any static host.

While you are there, serve `/.well-known/apple-app-site-association` if you want
universal links to open the app rather than Safari.

### 3. Deploy the backend

```bash
supabase link --project-ref uvtyiytbgkasemabtznc
supabase db push          # 50 migrations
supabase functions deploy # all functions
```

**Deploy the migration and the functions together, migration first.**
`00050_photo_moderation.sql` adds `Photo.moderationStatus`, and the `directory`
and `discover-nearby` functions now name that column in their `Photo` embed.
Functions deployed ahead of the migration will return 400 on every request.

The client is deliberately *not* coupled this way — `src/utils/visiblePhotos.js`
keeps any photo whose status is absent, so a client shipped ahead of the
migration degrades to previous behaviour instead of blanking every image.

Then set the server secrets:

```bash
supabase secrets set NODE_ENV=production
supabase secrets set MODERATION_PROVIDER=aws
supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
supabase secrets set JUNUBIN_INTERNAL_SECRET="$(openssl rand -hex 32)"
```

`MODERATION_PROVIDER` matters more than it looks: `moderate-image` fails closed
in production-like environments and returns 503 when no provider is set, so
photos would upload and simply never be scanned.

Finally the one-time `pg_net` wiring, in the SQL editor, or server-side push
never fires:

```sql
ALTER DATABASE postgres SET "app.edge_url"        = 'https://uvtyiytbgkasemabtznc.supabase.co/functions/v1';
ALTER DATABASE postgres SET "app.service_key"     = '<service-role-jwt>';
ALTER DATABASE postgres SET "app.internal_secret" = '<same value as JUNUBIN_INTERNAL_SECRET>';
```

### 4. Seed content, so the app is not empty

Directory and Nearby read real `User` rows. An empty database is an empty app.

```bash
SUPABASE_SERVICE_ROLE_KEY=... npm run seed:photos   # 12 portraits → photos/seed/
# then apply supabase/seed.sql and supabase/seeds/cities.sql
```

`supabase/seeds/cities.sql` is generated (`npm run seed:cities`) from
`src/data/cities.js`: 504 profiles, 6 in each of 84 cities, scattered 0.5–6 km
from each city centre. Both seed files are idempotent.

Run `seed:photos` **before** applying the SQL, or the rows will reference
storage objects that do not exist yet.

Plan how these come out. Every seeded row is prefixed `seed-`:

```sql
DELETE FROM "User" WHERE id LIKE 'seed-%';   -- FKs cascade Profile and Photo
```

### 5. Observability, before launch not after

Set in the EAS production env (`eas.json` → `build.production.env`):

- `EXPO_PUBLIC_SENTRY_DSN` — without it `App.js` skips `Sentry.init` entirely
  and every launch-week crash is invisible
- `EXPO_PUBLIC_POSTHOG_API_KEY` — only the host is set today, so the signup
  funnel is unmeasured

Also `supabase secrets set SENTRY_DSN=...` for edge-side capture.

### 6. App Store Connect

The Apple side is further along than the rest: `ascAppId 6766345463`, team ID
and a valid-looking `.p8` are already in `eas.json`, and the key file exists
locally and is correctly gitignored. Encryption-compliance flags are pre-set so
TestFlight will not nag.

Still to do:

- screenshots and description
- age rating — expect **17+** for a location-sharing UGC social app
- App Privacy questionnaire. Declare coarse location and photos. Do **not**
  declare contacts: that permission was removed (see below)
- confirm the privacy-policy and support URLs point at the now-live domain

---

## Fixed since the previous audit

For reference when reviewing the diff.

- **Photo moderation now enforces.** `00050_photo_moderation.sql` adds
  `moderationStatus` / `moderationVerdict` / `moderationCheckedAt` to `Photo`,
  backfills existing rows to `approved`, and indexes the review queue.
  `moderate-image` gained the `kind: 'photo'` branch the client was already
  calling and whose answer previously went nowhere. Rejected photos are filtered
  in `directory` and `discover-nearby` (server-side, and the status is stripped
  before it goes over the wire) and via `src/utils/visiblePhotos.js` in
  `profileService` and `AuthContext`.
  Display rule: **hide `rejected` only.** `pending` and `flagged` stay visible,
  and rows with no status are kept — a moderation outage must not become an
  "all photos vanished" outage.
- **Contacts permission removed.** `NSContactsUsageDescription`, `READ_CONTACTS`
  and the `expo-contacts` dependency are gone. No code ever touched the Contacts
  API; declaring it invited a rejection and an unjustifiable Play Data Safety
  entry.
- **Push token registration** now passes `projectId` explicitly and reports
  failures instead of silently returning `null`.
- **Seed photo URLs** repointed from a dead `res.cloudinary.com/placeholder`
  host to Supabase Storage, with `npm run seed:photos` to populate it.
- **Android submit** `serviceAccountKeyPath` corrected from `google-services.json`
  (a Firebase config, entirely the wrong file) to `./.secrets/play-service-account.json`.
- Version synced to `1.0.3`; `.env.example` purged of the deleted payments keys
  and now documents the SMS-provider and domain requirements.

---

## Known gaps — not blocking, worth deciding on

**No rate limiting anywhere.** No limit on messages, message requests, reports,
or OTP requests. The message-request gate (`chatService` rejects with
`not_connected`) blunts DM spam, but a determined actor can still hammer any
endpoint. Least effort, most value: a per-user-per-minute cap on message
requests and reports.

**The `photos` storage bucket has no size or MIME limits.** RLS is well-scoped —
public read, insert and delete confined to the caller's own user-id folder — but
the bucket accepts any file of any size. The client compresses to 1600px JPEG;
the client is not an enforcement boundary. One-line fix in a migration:
`UPDATE storage.buckets SET file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'] WHERE id = 'photos';`

**A rejected photo disappears for its owner too**, with no explanation. That is
safety-first but confusing. The follow-up is a "this photo was removed" notice
in Edit Profile. It is a product decision, which is why I did not build it.

**`conversationService.js` does not filter rejected photos.** Its query names
photo columns explicitly, so adding `moderationStatus` there would 400 if the
client shipped ahead of migration 00050. These are post-match chat avatars — the
lowest-risk surface. Close it once 00050 is confirmed applied.

**The `Post` table is dead code.** Migrations create it and `moderate-image`
still handles `kind: 'post'`, but nothing in `src/` reads or writes posts. Not
harmful; delete it or build the feed, but do not let it rot as a half-wired
moderation path.

**The Google Maps key is committed** in `eas.json`. Expected for a client key,
but restrict it to your bundle IDs in Google Cloud Console or you are exposed to
billing abuse.

**Liveness is a scaffold.** `EXPO_PUBLIC_LIVENESS_PROVIDER=none` means the photo
verification flow is a time-based UI with no real grading. Either wire AWS
Amplify or describe verification honestly in store copy as manual review — do
not advertise "verified" as an identity guarantee it cannot deliver.

---

## Post-deploy verification

Do this on a real device with a production build, not the simulator.

1. Sign up with a real phone number, receive a real SMS, complete the six-digit
   step
2. Complete profile setup, upload a photo, confirm it appears
3. Confirm the photo's `Photo.moderationStatus` moves off `pending` in the
   database — this is the proof that step 3 was wired correctly
4. Open Nearby; accept the location disclosure; confirm pins render (Android
   too — that is what the Maps key is for)
5. Search the directory for a seeded city, open a profile, send a message request
6. Confirm a push notification arrives, and that it deep-links to the right chat
7. Block and report from both a chat and a profile; confirm the user disappears
8. Delete the account from Settings; confirm the row is gone server-side, not
   soft-flagged
9. Follow the privacy, terms and support links; confirm all three load

---

## What I could not verify

I have no access to your Supabase project, App Store Connect, EAS, or DNS
registrar. The following are unknown and must be confirmed by hand:

- whether any migration or edge function is actually deployed
- whether Supabase Auth has an SMS provider configured
- whether the `.p8` App Store Connect key is still valid
- what metadata already exists in App Store Connect
- whether APNs credentials are uploaded to EAS (`eas credentials`)

Everything else in this document was read out of the repository or checked
against DNS on 2026-08-01.
