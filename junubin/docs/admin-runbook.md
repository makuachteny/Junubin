# JuNubin Admin Runbook

Operations playbook for moderators during the TestFlight + early
launch period. Everything in here can be done from the Supabase
dashboard until we build a proper admin UI in the app.

> ⚠️ **Audience**: you (the operator) and any moderators you grant
> access to the Supabase project. Do not share publicly.

---

## Quick links

- **Supabase project dashboard**: https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc
- **SQL editor**: https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc/sql/new
- **Table editor**: https://supabase.com/dashboard/project/uvtyiytbgkasemabtznc/editor

---

## 1. Photo verification — approve or reject

Run **daily** during beta until you have enough volume to batch.

### Find pending requests

```sql
SELECT
  vr.id,
  vr."userId",
  u."displayName",
  u.email,
  vr."photoUrl",
  vr."createdAt"
FROM "VerificationRequest" vr
JOIN "User" u ON u.id = vr."userId"
WHERE vr.status = 'pending'
ORDER BY vr."createdAt" ASC
LIMIT 50;
```

### Decide

Open the `photoUrl` in a new tab. Compare against the user's profile
photos (which you can grab with):

```sql
SELECT url FROM "Photo" WHERE "userId" = '<USER_ID_FROM_ABOVE>' ORDER BY "sortOrder";
```

### Approve

```sql
UPDATE "VerificationRequest"
SET status = 'approved',
    "reviewedBy" = 'admin:<your-name>',
    "reviewedAt" = NOW()
WHERE id = '<VERIFICATION_REQUEST_ID>';
```

The `trg_sync_user_verified` trigger (from [00029](../supabase/migrations/00029_audit_blockers.sql))
automatically sets `User.isVerified = TRUE`. The verified ✓ appears
on their profile next time it's fetched.

### Reject

```sql
UPDATE "VerificationRequest"
SET status = 'rejected',
    "rejectionReason" = '<short reason: photo blurry / doesn''t match / not human>',
    "reviewedBy" = 'admin:<your-name>',
    "reviewedAt" = NOW()
WHERE id = '<VERIFICATION_REQUEST_ID>';
```

Same trigger sets `User.isVerified = FALSE`. Users can re-submit a
new verification request anytime.

### Approval criteria

- ✅ Approve: face clearly visible, matches profile photos, no filter,
  not a photo of a photo, not obstructed.
- ❌ Reject: blurry, sunglasses cover face, filter heavily applied,
  appears to be a different person, photo of a screen.

---

## 2. Reports — triage and act

Run **daily**. Reports pile up faster than verifications.

### Pull the open queue

```sql
SELECT
  r.id,
  r."reporterId",
  ru."displayName" AS reporter_name,
  r."reportedUserId",
  rdu."displayName" AS reported_name,
  r.reason,
  r.details,
  r."createdAt"
FROM "Report" r
LEFT JOIN "User" ru  ON ru.id  = r."reporterId"
LEFT JOIN "User" rdu ON rdu.id = r."reportedUserId"
WHERE r.status IS NULL OR r.status = 'open'
ORDER BY r."createdAt" ASC
LIMIT 50;
```

### Action ladder

| Severity | Examples | Action |
|---|---|---|
| **Low** | One unsolicited DM, vague profile complaint | Mark report closed, no action |
| **Medium** | Repeated harassment, off-topic ads, mildly NSFW photo | Restrict account (`moderationStatus = 'restricted'`) for 7 days |
| **High** | Hate speech, slurs, sexual content, threats | Permanent ban (`moderationStatus = 'banned'`) |
| **Critical** | Minor involvement, doxxing, credible threats | Permanent ban + escalate to legal / law enforcement |

### Restrict (7-day timeout)

Restricted users can sign in and edit their profile but can't
swipe-like, message, post, or follow. The eligibility check at
[src/utils/eligibility.js](../src/utils/eligibility.js) returns
`{ ok: false, reason: 'restricted' }` for every dating/social action.

```sql
UPDATE "User"
SET "moderationStatus" = 'restricted'
WHERE id = '<REPORTED_USER_ID>';

INSERT INTO "UserModerationDetail" ("userId", reason, "createdAt")
VALUES ('<REPORTED_USER_ID>', '<short reason>', NOW());
```

A scheduled job (TODO — not yet built) lifts the restriction after
7 days. For now, manually run:

```sql
UPDATE "User" SET "moderationStatus" = 'active' WHERE id = '<USER_ID>';
```

### Ban (permanent)

```sql
UPDATE "User"
SET "moderationStatus" = 'banned'
WHERE id = '<REPORTED_USER_ID>';

INSERT INTO "UserModerationDetail" ("userId", reason, "createdAt")
VALUES ('<REPORTED_USER_ID>', '<reason>', NOW());
```

Banned users are force-signed-out the next time their session
resumes (handled in [AuthContext.js](../src/auth/AuthContext.js)).
They see an "Account closed" alert and the auth stack.

### Close the report

After acting, mark the report as resolved:

```sql
UPDATE "Report"
SET status = 'resolved',
    "resolvedBy" = 'admin:<your-name>',
    "resolvedAt" = NOW()
WHERE id = '<REPORT_ID>';
```

---

## 3. Unmatching / unblocking (only when warranted)

99% of the time, do not unmatch or unblock on a user's behalf — they
have those controls themselves. Only intervene when:

- The user emailed support saying they accidentally blocked someone.
- The user's account was hijacked, then recovered, and they want
  prior blocks reversed.

```sql
-- Unmatch (set both sides to 'unmatched')
UPDATE "Match"
SET status = 'unmatched'
WHERE "pairKey" = '<pair-key>';

-- Unblock
DELETE FROM "Block"
WHERE "blockerId" = '<blocker-user-id>' AND "blockedId" = '<blocked-user-id>';
```

---

## 4. Common emergency operations

### Force-sign-out a user (security incident)

Revoke their Supabase Auth session. They'll have to OTP back in:

```sql
DELETE FROM auth.sessions WHERE user_id = '<auth.uid>';
```

The next call to `supabase.auth.getSession()` returns null and the
client routes them to the auth stack.

### Delete a single post

```sql
DELETE FROM "Post" WHERE id = '<POST_ID>';
```

The cascade rules in `00012_posts_safety_unmatch.sql` clean up
comments and likes automatically.

### Delete a User row (manual cleanup — prefer the user's own delete flow)

The cleanest path is the `account-delete` Edge Function (which the
user triggers from Settings → Delete Account). For admin-initiated
deletion, invoke that function as service_role:

```bash
curl -X POST \
  https://uvtyiytbgkasemabtznc.supabase.co/functions/v1/account-delete \
  -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "<USER_ID>"}'
```

This wipes the User row, Photos in Storage, Posts, Comments, Matches,
Push tokens — everything in one shot.

---

## 5. Monitoring / health checks

### Daily

- Count pending verifications + open reports.
- Spot-check a few new signups for completeness.
- Check Supabase status (https://status.supabase.com).

### Weekly

- Storage usage per bucket — Supabase dashboard → Storage.
- DB size — Supabase dashboard → Database → Settings.
- Realtime worker stats — Supabase dashboard → Reports → Realtime.

### Useful one-liners

```sql
-- Active users in the last 7 days
SELECT COUNT(*) FROM "User"
WHERE "lastActiveAt" >= NOW() - INTERVAL '7 days';

-- New signups this week
SELECT COUNT(*) FROM "User"
WHERE "createdAt" >= NOW() - INTERVAL '7 days';

-- Matches created this week
SELECT COUNT(*) FROM "Match"
WHERE "createdAt" >= NOW() - INTERVAL '7 days';

-- Messages sent this week
SELECT COUNT(*) FROM "Message"
WHERE "createdAt" >= NOW() - INTERVAL '7 days';

-- Pending verification backlog
SELECT COUNT(*) FROM "VerificationRequest"
WHERE status = 'pending';

-- Open report backlog
SELECT COUNT(*) FROM "Report"
WHERE status IS NULL OR status = 'open';
```

---

## 6. Anti-patterns — DON'T do these

- ❌ Don't manually approve verifications without comparing photos.
  Sets a fake-verified ✓ that erodes trust.
- ❌ Don't ban based on a single report without reading the actual
  content. Bad-faith reporting is a thing.
- ❌ Don't delete a Photo row without also deleting the corresponding
  storage object. Use the in-app `deletePhoto` (or the
  `delete_photo` RPC from 00030) to keep the two in sync.
- ❌ Don't share screenshots of user reports outside the moderation
  team. Reporters are promised confidentiality.

---

## Update history

- 2026-05-14: Initial runbook for TestFlight launch.
