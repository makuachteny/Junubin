# JuNubin Privacy Policy

**Last updated:** 2026-05-14
**Effective:** [INSERT DATE WHEN HOSTED]

> ⚠️ **Operator note**: this is a template. Read the bracketed `[INSERT …]`
> placeholders, fill them in, and have a lawyer in your jurisdiction
> review before publishing. App Review will fetch the live URL — make
> sure it resolves and matches what you submit in App Store Connect.

JuNubin ("we", "our", "the app") helps people in the South Sudanese
diaspora connect for dating, friendship, and community. This policy
explains what data we collect, why, where it's stored, and what rights
you have over it.

---

## 1. Information we collect

### 1.1 Information you give us

- **Email address** — required to create an account. We use it to send
  one-time sign-in codes and account-related notifications.
- **Profile information** — name, date of birth, gender, pronouns,
  ethnicity, education, sexuality (if dating), dating preferences,
  photos, prompt answers, and the bio you write.
- **Photos** — every photo you upload, including verification selfies.
- **Messages, posts, comments, stories, voice notes** — content you
  create inside the app.
- **Reports and blocks** — when you flag or block someone, we keep a
  record so our moderation team can act on it.

### 1.2 Information we collect automatically

- **Device information** — model, OS version, app version, and locale.
- **Approximate location** — only when you allow it, used to surface
  nearby matches and events. We do not track precise GPS in the
  background.
- **Usage events** — which screens you opened, when you swiped,
  matched, or messaged. We pseudonymise this by stripping personally
  identifying fields before logging.
- **Contacts** — only if you grant permission and use the "Find
  Friends" feature. We hash phone numbers locally and check them
  against our user index. We do not store your contact list.

### 1.3 Information from third parties

- **Apple / Google** — receipts when you make in-app purchases.
- **Stripe / Flutterwave / RevenueCat** — minimum payment metadata
  needed to process subscriptions and creator payouts. We never see
  full card numbers.

---

## 2. How we use information

| Purpose | Categories |
|---|---|
| Authenticate you | Email, device id |
| Show your profile to other users | Profile, photos |
| Match-making algorithm | Profile, swipes, preferences, location |
| Send notifications | Push token, account events |
| Moderate the platform | Reports, blocks, content, verification photos |
| Process payments | Purchase metadata |
| Comply with the law | All of the above, when legally compelled |
| Improve the app | Aggregated usage events |

We do **not** sell your data, share it with advertisers, or use it to
profile you across other companies' apps or websites.

---

## 3. Where data is stored

JuNubin uses [Supabase](https://supabase.com) for our database,
authentication, and file storage. Supabase runs on AWS infrastructure
in the [INSERT REGION, e.g. `us-east-1`] region. Your data may be
processed in the United States.

Payment data passes through [Stripe](https://stripe.com),
[Flutterwave](https://flutterwave.com), and/or
[RevenueCat](https://revenuecat.com) depending on the rail you used.

---

## 4. Photo verification

When you submit a verification selfie, the photo is uploaded to our
Storage bucket and a corresponding `VerificationRequest` row is
created in our database. A member of our moderation team reviews each
submission and marks it `approved` or `rejected`. Approved photos
flip your `isVerified` badge on. We retain verification photos for
[INSERT RETENTION — e.g. 90 days] for audit purposes, after which they
are deleted.

---

## 5. Your rights

You can:

- **View, edit, or download your profile** — from Settings → Edit
  Profile.
- **Delete your account** — from Settings → Delete Account. Deletion
  is permanent and removes your User row, Profile row, Photos, Posts,
  Comments, Matches, Messages, and push token. Some records we are
  legally required to keep (e.g. payment receipts for tax reporting)
  are retained for as long as the law requires, then deleted.
- **Withdraw consent** — turn off location, contacts, or push
  notification permissions from your phone's Settings app at any time.
- **Request a copy of your data (GDPR/CCPA)** — email
  [INSERT SUPPORT EMAIL] with subject "Data Export Request".

Account deletion is implemented in the [account-delete edge
function](https://github.com/[YOUR REPO]/junubin/blob/main/supabase/functions/account-delete/index.ts).

---

## 6. Children

JuNubin is 17+. We do not knowingly collect data from anyone under 18.
Date-of-birth is required at sign-up and validated server-side
(`User_minimum_age_chk` constraint). If you believe a minor has an
account, please report it to [INSERT SUPPORT EMAIL] and we will close
the account.

---

## 7. Cookies and tracking

The app does not use cookies. We do not run any cross-app tracking SDK
and have not requested App Tracking Transparency permission.

---

## 8. Changes to this policy

We will update this page when we materially change how we collect or
use data, and we will email registered users at least 7 days before
the changes take effect.

---

## 9. Contact

For privacy questions, data export requests, or to report a privacy
issue, email **[INSERT SUPPORT EMAIL]**.
