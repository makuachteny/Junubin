# App Store Submission Checklist

Things to gather + paste into App Store Connect when you move from
TestFlight (where you are now) to the public App Store.

> Build 1.0.1 (14) is already on TestFlight. This doc is the runbook
> for the next step: production release.

---

## 1. App Store Connect metadata fields

Open https://appstoreconnect.apple.com/apps/6766345463 → **App Store**
tab. Fill these in:

### App Information

| Field | Suggested value |
|---|---|
| Subtitle (30 chars) | `Dating for the diaspora` |
| Privacy Policy URL | https://junubin.app/privacy (after hosting [docs/privacy-policy.md](./privacy-policy.md)) |
| Support URL | https://junubin.app/support (or a Zendesk / mailto page) |
| Marketing URL (optional) | https://junubin.app |
| Category (Primary) | Social Networking |
| Category (Secondary) | Lifestyle |

### Pricing and Availability

| Field | Value |
|---|---|
| Price | Free |
| Availability | All territories (or restrict to launch markets) |
| Distribution | Make this app available on the App Store |

### App Privacy

Click **Get Started** under Data Types. Declare each datatype
honestly:

| Data type | Linked to user? | Used for tracking? | Purposes |
|---|---|---|---|
| Email address | ✅ Yes | ❌ No | App Functionality, Account Management |
| Phone number | ❌ Not collected | — | — |
| Photos | ✅ Yes | ❌ No | App Functionality (profile + verification) |
| User content (posts, messages) | ✅ Yes | ❌ No | App Functionality |
| Coarse location | ✅ Yes | ❌ No | App Functionality (nearby matches) |
| Contacts | ❌ Not collected (hashed locally, never uploaded) | — | — |
| Identifiers (User ID) | ✅ Yes | ❌ No | App Functionality |
| Usage data | ❌ Not linked | ❌ No | Analytics (anonymised) |
| Diagnostics | ❌ Not linked | ❌ No | App Functionality, Crash Diagnostics |

### Age Rating

Click **Edit** next to Age Rating. Dating + Social apps:

| Question | Answer |
|---|---|
| Infrequent / mild sexual content and nudity | Yes (profile selfies) |
| Frequent / intense sexual content | No |
| Profanity or crude humor | Infrequent / mild |
| Alcohol, tobacco, drug use or references | Infrequent / mild |
| Mature / suggestive themes | Infrequent / mild |
| Horror / fear themes | No |
| Cartoon or fantasy violence | No |
| Unrestricted Web Access | No |
| Gambling and Contests | No |

Result: **17+**.

---

## 2. Screenshots (mandatory)

Apple requires at least one screenshot for **6.7" iPhone (iPhone 14
Pro Max)** at **1290 × 2796** pixels. Optional: 5.5" iPhone (iPhone 8
Plus, 1242 × 2208), iPad if you ever enable `supportsTablet`.

### Required: 6.7" iPhone (3–10 screenshots)

Take these from your TestFlight build on an iPhone 15 Pro Max or use
Xcode → iOS Simulator with that device. Captions help — keep them
under 30 chars.

| # | Screen | Caption |
|---|---|---|
| 1 | Home swipe deck with a profile visible | _"Meet your people"_ |
| 2 | Match celebration overlay | _"Sparks fly"_ |
| 3 | Chat with reactions | _"Real conversations"_ |
| 4 | Community feed | _"Beyond dating"_ |
| 5 | Stories row | _"Stay in the loop"_ |
| 6 | Profile detail with verified badge | _"Verified profiles"_ |

Drop them into App Store Connect → App Store → 1.0.1 → Media.

---

## 3. App description (≤4000 chars)

Paste this in **App Information → Description**:

```
JuNubin is the home for the South Sudanese diaspora to date, make
friends, and build community — wherever you are.

DATING THAT GETS YOU
Match with people who share your culture, language, and values. Tell
us if you're here for something serious, casual, or to just see where
it goes. Swipe through profiles filtered by tribe, intention, and
distance.

SOCIAL WHEN YOU WANT
Not looking for romance today? Flip to Social mode. Make friends,
join cultural events near you, and connect with the diaspora in your
city — Juba, London, Minneapolis, Sydney, and more.

REAL PEOPLE
Verified profiles get a blue checkmark. Photo verification keeps the
app real — no catfishing, no bots, no fake accounts.

COMMUNITY
Share posts, stories, and live moments with the people you match
with. Join groups around your interests. Discover events happening
in your city.

SAFETY FIRST
Block, report, and unmatch tools. 24-hour moderation. Privacy
controls in every direction. Screenshot guard on private chats.

JuNubin is built BY the diaspora FOR the diaspora. South Sudanese.
Junub. Wherever you are, you have people here.

---
Terms of Use: https://junubin.app/terms
Privacy Policy: https://junubin.app/privacy
```

### Keywords (≤100 chars, comma-separated)

```
south sudanese,diaspora,dating,junub,africa,community,friends,events,nuer,dinka,bari,shilluk
```

---

## 4. Review notes (CRUCIAL — Apple reviewers read this)

Open the **Version Information** section for build 1.0.1 → "App
Review Information". Paste:

```
Sign-in account for review:

  Email: appreview@junubin.app
  OTP code: 000000 (use the Apple Reviewer override OTP we configured
            in Supabase Auth — see operator note below)

How to use:

  1. Open the app. Tap "Get Started" on the welcome screen.
  2. Enter the email above. A 6-digit OTP appears in the email; for
     review purposes the override code is 000000.
  3. After signing in, you'll land directly on Home (this account
     already completed onboarding).
  4. Swipe on the cards in the Home tab. Tap the heart to like,
     X to pass.
  5. The Messages tab shows existing conversations with realistic
     match data.
  6. Tap Settings → Verify Your Photo to see the verification flow
     (submits a "pending" review request — does not auto-verify).

Notes for reviewers:

  - This is a dating + community app for the South Sudanese diaspora.
  - All user data shown belongs to test accounts created for review.
  - The "Coming soon" payment screens are intentional — payments are
    disabled in v1.0.1 and will launch with v1.1.0.
  - No tracking, no advertising, no third-party SDKs collecting
    cross-app data.

Contact for App Review questions: [INSERT YOUR EMAIL]
```

> ⚠️ **Operator note — demo account setup**:
>
> Before submitting, you must create a real account for Apple's
> reviewers with these credentials. Two ways:
>
> 1. Easiest: have someone sign up with `appreview@junubin.app`,
>    finish ProfileSetup (use 3 stock photos), and tell them not to
>    delete it.
> 2. Better: configure a Supabase Auth override that always accepts
>    `000000` as the OTP for that specific email. In Supabase →
>    Authentication → Email → "Test OTP", whitelist that one email.

---

## 5. Build selection

Choose build `1.0.1 (14)` from the dropdown. App Store version `1.0.1`.

### "What's new in this version" (3500 chars)

For the first public release just say:

```
Welcome to JuNubin v1.0! 🎉

The first version of JuNubin, the dating + social app built for
the South Sudanese diaspora. Match, message, post, and connect with
your people, wherever you are.
```

---

## 6. Before clicking Submit for Review

Run through this list one more time:

- [ ] Privacy Policy URL resolves (no 404).
- [ ] Support URL resolves with at least an email contact.
- [ ] Screenshots match the actual current build (not v1.0.0 leftovers).
- [ ] Demo account works on a fresh device.
- [ ] All `Coming soon` screens are explained in the review notes.
- [ ] Age rating is 17+ and matches your actual content level.
- [ ] No "test mode" / "debug" toggles visible in the shipped binary.
- [ ] App Tracking Transparency permission string is NOT in
      [app.config.js](../app.config.js) — confirmed removed in 1.0.1.
- [ ] `EXPO_PUBLIC_DEV_BYPASS_AUTH` is not set in your prod env.

---

## 7. Expect 1–2 review rounds

Dating apps typically get one rejection on first submission. Common
reasons:

1. **"We need a demo account"** — provide better creds in review
   notes.
2. **"Your profile shows fake users"** — Apple thinks your seeded
   testers are bots. Reply with a list of real accounts.
3. **"Privacy policy doesn't address X"** — update the policy and
   re-submit.
4. **"Account deletion isn't obvious enough"** — the Delete Account
   button must be in Settings, not buried. It is — point them to
   `Settings → Delete Account` in the reply.

Average turnaround: 24–48 hrs per round.

---

## 8. After approval

In App Store Connect:

1. Click **Release this version** (or set auto-release on approval).
2. Your app is on the public App Store within ~4 hrs.
3. The TestFlight build keeps working for testers — they continue
   getting updates via TestFlight unless you stop the beta.

---

## Update history

- 2026-05-14: Initial submission checklist for v1.0.1.
