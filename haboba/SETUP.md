# Haboba (JuNubin) — Deployment Guide

Everything you need to take the app from local development to production on Render.

---

## Table of Contents

1. [Accounts to Create](#1-accounts-to-create)
2. [Generate Production Secrets](#2-generate-production-secrets)
3. [Set Up Render PostgreSQL](#3-set-up-render-postgresql)
4. [Set Up Cloudinary](#4-set-up-cloudinary)
5. [Deploy the Backend on Render](#5-deploy-the-backend-on-render)
6. [Set Up Twilio for OTP](#6-set-up-twilio-for-otp)
7. [Set Up Sentry for Monitoring](#7-set-up-sentry-for-monitoring)
8. [Set Up Cloudflare for DNS and Protection](#8-set-up-cloudflare-for-dns-and-protection)
9. [Set Up Uptime Monitoring](#9-set-up-uptime-monitoring)
10. [Build and Submit the Mobile App](#10-build-and-submit-the-mobile-app)
11. [Encryption and Security Overview](#11-encryption-and-security-overview)
12. [Monitoring Overview](#12-monitoring-overview)
13. [Production Environment Variables Reference](#13-production-environment-variables-reference)
14. [Post-Deploy Checklist](#14-post-deploy-checklist)
15. [Configure EAS Secrets](#15-configure-eas-secrets-required-before-building)
16. [Set Up GitHub Actions CI/CD](#16-set-up-github-actions-cicd)
17. [OTA Updates with EAS Update](#17-ota-updates-with-eas-update)
18. [Dynamic App Configuration](#18-dynamic-app-configuration)

---

## 1. Accounts to Create

Create these accounts **in order** — each step feeds into the next.

| #  | Service                  | Purpose                          | Cost              | URL                              |
|----|--------------------------|----------------------------------|--------------------|----------------------------------|
| 1  | **GitHub**               | Code hosting (if not already)    | Free               | https://github.com               |
| 2  | **Render**               | API hosting + PostgreSQL         | $14/mo (2 starters)| https://render.com               |
| 3  | **Cloudinary**           | User photo storage + CDN         | Free (25GB)        | https://cloudinary.com           |
| 4  | **Twilio**               | SMS OTP verification             | Pay-per-SMS        | https://twilio.com               |
| 5  | **Sentry**               | Error tracking + crash reports   | Free (5K events/mo)| https://sentry.io                |
| 6  | **Cloudflare**           | DNS, CDN, DDoS/WAF protection    | Free               | https://cloudflare.com           |
| 7  | **BetterStack**          | Uptime monitoring + alerting     | Free               | https://betterstack.com          |
| 8  | **Expo (EAS)**           | Build + submit mobile app        | Free tier           | https://expo.dev                 |
| 9  | **Apple Developer**      | Publish to App Store             | $99/year           | https://developer.apple.com      |
| 10 | **Google Play Console**  | Publish to Google Play           | $25 one-time       | https://play.google.com/console  |

**Optional but recommended later:**

| Service        | Purpose                                    | Cost        |
|----------------|--------------------------------------------|-------------|
| **RevenueCat** | Manage subscriptions across iOS/Android     | Free to start |
| **PostHog**    | Product analytics (swipe rates, retention)  | Free tier   |

---

## 2. Generate Production Secrets

Run these on your local machine. **Save the outputs somewhere safe** — you will paste them into Render.

### JWT Secret (256-bit)

```bash
openssl rand -hex 64
```

a29cc9e73c98ca8dcb522680bef05b26ed8a72d545c081a89981cc3bcc16f5b27bd2c4866fc9696f69d054ef522c20dace2390919542a134d6b1c3b33ed1a433

This generates a 128-character hex string. Copy the entire output.

**Rules for this secret:**
- Never commit it to git
- Never reuse your dev secret (`ab9e2b7...`) in production
- Store it only in Render's environment variables
- If compromised, rotate immediately (all users will need to re-login)

---

## 3. Set Up Render PostgreSQL

### Step-by-step

1. Go to https://dashboard.render.com
2. Click **New** → **PostgreSQL**
3. Configure:
   - **Name:** `junubin-db`
   - **Database:** `junubin`
   - **User:** `junubin_user`
   - **Region:** Oregon (US West) — or closest to your users
   - **Plan:** Starter ($7/mo)
4. Click **Create Database**
5. Wait for it to spin up (1-2 minutes)
6. Go to the database dashboard → **Connections** → copy the **Internal Database URL**
   - It looks like: `postgresql://junubin_user:PASSWORD@dpg-XXXXX-a/junubin`
   postgresql://junubin_user:VEKLicXRRV25h4uul2bREwxTKnSvtHYt@dpg-d6hqhpi4d50c73fgeucg-a/junubin

   - Use the **Internal URL** if your API is also on Render (same region) — it's faster and free
   - Use the **External URL** only for local tools like `psql` or Prisma Studio

**Important:** The internal URL only works from other Render services in the same region.

---

## 4. Set Up Cloudinary

### Step-by-step

1. Go to https://cloudinary.com → Sign up
2. On the dashboard, you'll see:
   - **Cloud Name** (e.g., `dazivz9p6`)
   - **API Key** (969174543464866)
   - **API Secret** (**********)
   - **API environment variable ** (CLOUDINARY_URL=cloudinary://969174543464866:**********@dazivz9p6)
3. Copy all three — you'll paste them into Render env vars
4. Go to **Settings** → **Upload** → **Upload presets**
   - Create an **unsigned** preset named `junubin_photos`
   - Set folder to `junubin/photos`
   - Set allowed formats: `jpg, png, webp`
   - Set max file size: `10000000` (10MB)
5. Go to **Settings** → **Security**
   - Enable **Strict transformations** (prevents abuse)

---

## 5. Deploy the Backend on Render

### Option A: Auto-deploy from render.yaml (Recommended)

Your `render.yaml` is already configured at `haboba/backend/render.yaml`.

1. Push your code to GitHub (make sure `.env` is in `.gitignore`)
2. Go to https://dashboard.render.com
3. Click **New** → **Blueprint**
4. Connect your GitHub repo
5. Render reads `render.yaml` and sets up the service automatically
6. You'll be prompted to fill in the secret env vars:
   - `DATABASE_URL` → paste the **Internal Database URL** from step 3
   - `JWT_SECRET` → paste the output from step 2
   - `CORS_ORIGIN` → set to your app's domain (e.g., `https://junubin-api.onrender.com`) or `*` temporarily
7. Click **Apply**

### Option B: Manual setup

1. Click **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name:** `junubin-api`
   - **Region:** Same as your database
   - **Branch:** `main`
   - **Root Directory:** `haboba/backend`
   - **Runtime:** Node
   - **Build Command:** `npm install && npx prisma generate`
   - **Start Command:** `npx prisma migrate deploy && node src/server.js`
   - **Plan:** Starter ($7/mo)
4. Add environment variables (see section 13 for the full list)
5. Click **Create Web Service**

### After deploy

1. Render gives you a URL like `https://junubin-api.onrender.com`
2. Test the health check:
   ```bash
   curl https://junubin-api.onrender.com/v1/health
   ```
   You should get: `{"status":"ok"}`
3. Test the root:
   ```bash
   curl https://junubin-api.onrender.com/
   ```
   You should get: `{"service":"JuNubin API","status":"running"}`

### Auto-deploy

Render auto-deploys on every push to `main`. To disable this, go to **Settings** → turn off **Auto-Deploy**.

---

## 6. Set Up Twilio for OTP

Your app currently uses a hardcoded OTP (`123456`) in development. For production, you need a real SMS provider.

### Step-by-step

1. Go to https://twilio.com → Sign up
2. Complete phone verification
3. From the dashboard, copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token**
4. Go to **Phone Numbers** → **Buy a Number**
   - Get a number with SMS capability
   - Copy the phone number (e.g., `+1234567890`)
5. (Optional) Set up **Twilio Verify** service for managed OTP:
   - Go to **Verify** → **Create Service**
   - Name it `JuNubin`
   - Enable SMS channel
   - Copy the **Service SID** (starts with `VA`)

### Environment variables to add to Render

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_VERIFY_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  (if using Verify)
```

### Code changes needed

You will need to update the OTP route in your backend to call Twilio instead of using the hardcoded `123456`. The Twilio Verify API handles:
- Sending the OTP SMS
- Rate limiting attempts
- Verifying the code
- Expiring old codes

---

## 7. Set Up Sentry for Monitoring

### Step-by-step (Backend)

1. Go to https://sentry.io → Sign up
2. Create a new project:
   - Platform: **Node.js** → **Express**
   - Name: `junubin-api`
3. Copy the **DSN** (looks like `https://xxxxx@o1234.ingest.sentry.io/5678`)
4. Add to Render env vars:
   ```
   SENTRY_DSN=https://xxxxx@o1234.ingest.sentry.io/5678
   ```

### Code changes needed

Install the Sentry SDK in your backend:

```bash
cd haboba/backend && npm install @sentry/node
```

Then add Sentry to `src/app.js`:

```js
// At the very top of app.js, before other imports
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1, // 10% of requests traced (adjust as needed)
});

// After creating the express app:
app.use(Sentry.Handlers.requestHandler());

// Before the 404 handler, after all routes:
app.use(Sentry.Handlers.errorHandler());
```

### Step-by-step (Mobile App)

1. In Sentry, create another project:
   - Platform: **React Native**
   - Name: `junubin-mobile`
2. Copy the DSN
3. Install in the frontend:
   ```bash
   cd haboba && npx expo install @sentry/react-native
   ```
4. Add to `app.json` plugins and initialize in `App.js`

### What Sentry gives you

- Every unhandled error with full stack trace
- Request context (URL, headers, user ID)
- Release tracking (see which deploy introduced a bug)
- Performance monitoring (slow API endpoints)
- Mobile crash reports with device info

---

## 8. Set Up Cloudflare for DNS and Protection

This is optional for launch but recommended for production.

### Step-by-step

1. Go to https://cloudflare.com → Sign up
2. Buy or transfer your domain (e.g., `haboba.app` or `junubin.com`)
3. Add your domain to Cloudflare
4. Update your domain's nameservers to Cloudflare's (they'll tell you which ones)
5. In Cloudflare DNS, add a CNAME record:
   - **Name:** `api`
   - **Target:** `junubin-api.onrender.com`
   - **Proxy:** ON (orange cloud)
6. In Render, go to your web service → **Settings** → **Custom Domains** → add `api.haboba.app`

### What Cloudflare gives you (free tier)

- DDoS protection
- WAF (Web Application Firewall) — blocks common attacks
- SSL/TLS — HTTPS everywhere
- CDN — caches static responses at the edge
- Analytics — request volume, threats blocked, bandwidth

---

## 9. Set Up Uptime Monitoring

### Step-by-step (BetterStack)

1. Go to https://betterstack.com → Sign up
2. Create a new **Monitor**:
   - **URL:** `https://junubin-api.onrender.com/v1/health`
   - **Check interval:** 60 seconds
   - **Alert via:** Email + SMS (add your phone number)
3. Create a **Status Page** (optional, public URL showing uptime)

### What it does

- Pings your health endpoint every minute
- Sends you an alert within 60 seconds if the API goes down
- Tracks uptime percentage over time
- Provides an incident timeline

---

## 10. Build and Submit the Mobile App

### Prerequisites

1. Create an Expo account at https://expo.dev
2. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Initialize EAS in your project:
   ```bash
   cd haboba
   eas init
   ```

### Configure the production API URL

Before building, set the production API URL. In your EAS build profile (`eas.json`):

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://junubin-api.onrender.com/v1"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

### Build for iOS

```bash
eas build --platform ios --profile production
```

- First time: EAS will ask you to log in to your Apple Developer account
- It generates certificates and provisioning profiles automatically
- Build takes 15-30 minutes
- You'll get a download link for the `.ipa` file

### Build for Android

```bash
eas build --platform android --profile production
```

- First time: EAS generates a keystore automatically (save the backup!)
- Build takes 10-20 minutes
- You'll get a download link for the `.aab` file

### Submit to App Store

```bash
eas submit --platform ios
```

- Uploads to App Store Connect
- You'll still need to fill in screenshots, description, and pricing in App Store Connect
- Apple review takes 1-3 days

### Submit to Google Play

```bash
eas submit --platform android
```

- Uploads to Google Play Console
- Fill in the store listing, content rating, and pricing
- Google review takes a few hours to 2 days

---

## 11. Encryption and Security Overview

### What's already built and working

```
LAYER              WHAT IT DOES                         WHERE IN CODE
─────              ────────────                         ────────────
Password hashing   bcrypt with 12 salt rounds           auth routes
JWT tokens         Signed access tokens (7d expiry)     middleware/auth.js
Refresh tokens     Crypto-random 48-byte hex strings    auth routes
Helmet.js          Security headers (CSP, HSTS, etc.)   app.js line 19
Rate limiting      100/min global, 10/min auth          app.js lines 28-44
CORS               Configurable allowed origins          app.js lines 20-25
Input validation   Zod schemas on all inputs            route handlers
```

### How data flows in production

```
┌──────────────┐       TLS 1.2+        ┌──────────────┐      SSL       ┌──────────┐
│  User Phone  │ ◄──────────────────► │  Render API  │ ◄────────────► │ Render DB│
│              │   All data encrypted  │  (Express)   │  Internal net  │ (Postgres)│
│  AsyncStorage│   in transit          │              │  + SSL         │           │
│  (OS-level   │                       │  Helmet.js   │                │  Encrypted│
│   encryption)│                       │  Rate Limits │                │  at rest  │
└──────────────┘                       └──────────────┘                └──────────┘
```

### Encryption layers explained

**1. In Transit (TLS/HTTPS)**
- All traffic between the phone and API is encrypted with TLS 1.2+
- Render provides this automatically — no setup needed
- Socket.IO connections also use TLS (wss://)
- Database connections use SSL within Render's network

**2. At Rest (Storage)**
- Render PostgreSQL encrypts data on disk (AES-256)
- Cloudinary stores photos encrypted at rest
- On the phone, AsyncStorage is encrypted by the OS (iOS Keychain / Android Keystore)

**3. Passwords**
- Never stored in plain text
- Hashed using bcrypt with 12 salt rounds (takes ~250ms to hash)
- Even if the database is breached, passwords can't be reversed
- bcrypt automatically handles salting (each password gets a unique salt)

**4. Authentication Tokens**
- Access token: JWT signed with your `JWT_SECRET` using HMAC-SHA256
- Refresh token: 48 bytes of cryptographically random data (via `crypto.randomBytes`)
- Refresh tokens are stored hashed in the database
- On token refresh, the old token is invalidated (rotation)

**5. Security Headers (Helmet.js)**
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: DENY` — prevents clickjacking
- `Strict-Transport-Security` — forces HTTPS
- `Content-Security-Policy` — restricts resource loading
- `X-Powered-By` — removed (hides Express)

### What to add later (not needed for launch)

**End-to-End Encrypted Messages (E2E)**
- Currently messages are stored as plain text in the database
- For E2E, use Signal Protocol or Virgil E3Kit
- Messages would be encrypted on the sender's phone and only decrypted on the recipient's phone
- The server would never see message content
- This is a large feature — plan for v2

**Photo Signed URLs**
- Configure Cloudinary to use signed URLs with expiry
- Photos become inaccessible after the URL expires
- Prevents hotlinking and unauthorized access

---

## 12. Monitoring Overview

### Four layers of monitoring

```
┌─────────────────────────────────────────────────────┐
│  Layer 4: PRODUCT ANALYTICS (PostHog — optional)    │
│  Swipe rates, match rates, retention, funnels       │
├─────────────────────────────────────────────────────┤
│  Layer 3: ERROR TRACKING (Sentry)                   │
│  Stack traces, crash reports, release tracking      │
├─────────────────────────────────────────────────────┤
│  Layer 2: LOGGING (Render dashboard + Morgan)       │
│  Request logs, response times, stdout               │
├─────────────────────────────────────────────────────┤
│  Layer 1: UPTIME (BetterStack)                      │
│  Health check pings, downtime alerts via SMS/email  │
└─────────────────────────────────────────────────────┘
```

### Key metrics to watch

| Metric                  | Where to Check      | Alert If                |
|-------------------------|---------------------|-------------------------|
| API uptime              | BetterStack         | Health check fails      |
| Error rate (5xx)        | Sentry              | > 1% of requests        |
| Response time (p95)     | Render dashboard    | > 500ms                 |
| Database connections    | Render DB dashboard | > 80% of pool           |
| Memory usage            | Render dashboard    | > 90% of limit          |
| Socket.IO connections   | Render logs         | Sudden drop to 0        |
| Auth failures           | Sentry              | Spike in 401s           |
| Disk usage (database)   | Render DB dashboard | > 80% of plan limit     |

### Render dashboard gives you (free, no setup)

- CPU and memory usage graphs
- Request count and response time
- Deploy history and rollback
- Log viewer (stdout from Morgan)
- Database metrics (connections, storage, queries)

---

## 13. Production Environment Variables Reference

Set all of these in your Render web service → **Environment** tab.

### Required

| Variable              | Example Value                                       | Notes                            |
|-----------------------|-----------------------------------------------------|----------------------------------|
| `NODE_ENV`            | `production`                                        | Already set in render.yaml       |
| `PORT`                | `4000`                                              | Already set in render.yaml       |
| `DATABASE_URL`        | `postgresql://user:pass@host/junubin?sslmode=require` | Internal URL from Render DB. Add `?sslmode=require` |
| `JWT_SECRET`          | (output of `openssl rand -hex 64`)                  | Never commit to git              |
| `JWT_EXPIRES_IN`      | `7d`                                                | Already set in render.yaml       |
| `CORS_ORIGIN`         | `https://junubin-api.onrender.com`                  | Or your custom domain. Do NOT use `*` in production |

### Cloudinary (required for photo uploads)

| Variable                  | Example Value       | Notes                    |
|---------------------------|---------------------|--------------------------|
| `CLOUDINARY_CLOUD_NAME`   | `dxxxxxxxxx`        | From Cloudinary dashboard|
| `CLOUDINARY_API_KEY`       | `123456789012345`   | From Cloudinary dashboard|
| `CLOUDINARY_API_SECRET`    | `abcdefghijk...`    | From Cloudinary dashboard|

### Sentry (required for monitoring)

| Variable      | Example Value                                       |
|---------------|-----------------------------------------------------|
| `SENTRY_DSN`  | `https://xxxxx@o1234.ingest.sentry.io/5678`        |

### Twilio (required for production OTP)

| Variable                | Example Value                          |
|-------------------------|----------------------------------------|
| `TWILIO_ACCOUNT_SID`    | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |
| `TWILIO_AUTH_TOKEN`      | `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`     |
| `TWILIO_PHONE_NUMBER`    | `+1234567890`                          |
| `TWILIO_VERIFY_SID`     | `VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`   |

---

## 14. Post-Deploy Checklist

Run through this after your first successful deploy.

### Immediate (before any users)

- [ ] Health check returns 200: `curl https://YOUR-URL/v1/health`
- [ ] JWT_SECRET is a fresh production value (not the dev one)
- [ ] DATABASE_URL points to Render PostgreSQL (not localhost)
- [ ] CORS_ORIGIN is set to your domain (not `*`)
- [ ] Sentry is receiving test errors
- [ ] BetterStack is pinging your health endpoint
- [ ] Cloudinary uploads work (test with a photo)
- [ ] Database migrations ran successfully (check Render deploy logs)

### Before public launch

- [ ] Twilio OTP is working (replace hardcoded `123456`)
- [ ] Apple Developer account approved + app submitted
- [ ] Google Play Console set up + app submitted
- [ ] Cloudflare DNS configured (if using custom domain)
- [ ] Rate limits tested (try hitting auth endpoint 11 times in a minute)
- [ ] Socket.IO connections work over wss:// (test chat in production)
- [ ] Photo uploads work end-to-end (upload from phone → visible in app)
- [ ] Push notifications configured (via Expo Push or FCM/APNs)

### CI/CD pipeline

- [ ] `EXPO_TOKEN` added to GitHub Secrets
- [ ] `RENDER_DEPLOY_HOOK_URL` added to GitHub Secrets
- [ ] Test PR triggers `test-frontend` and `test-backend` jobs
- [ ] Merge to main triggers `eas-build` and `deploy-backend` jobs

### EAS secrets

- [ ] `EAS_PROJECT_ID` stored in EAS secrets
- [ ] `EXPO_PUBLIC_SUPABASE_URL` stored in EAS secrets
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` stored in EAS secrets
- [ ] `YOUR_ASC_APP_ID` replaced in eas.json with real value
- [ ] `YOUR_APPLE_TEAM_ID` replaced in eas.json with real value
- [ ] `google-services.json` added for Android submission

### After launch

- [ ] Set up daily backup verification for database
- [ ] Monitor Sentry for first real-user errors
- [ ] Watch Render metrics for memory/CPU patterns
- [ ] Set up Sentry alerts for error rate spikes
- [ ] Review Cloudflare analytics for suspicious traffic
- [ ] Test OTA update flow: push an update to preview channel, verify it arrives

---

## Monthly Cost Estimate

### At launch (0-1K users)

| Service              | Plan      | Cost/mo |
|----------------------|-----------|---------|
| Render Web Service   | Starter   | $7      |
| Render PostgreSQL    | Starter   | $7      |
| Cloudinary           | Free      | $0      |
| Sentry               | Free      | $0      |
| BetterStack          | Free      | $0      |
| Cloudflare           | Free      | $0      |
| Twilio SMS           | Pay-as-go | ~$5     |
| **Total**            |           | **~$19/mo** |

### Growing (1K-10K users)

| Service              | Plan        | Cost/mo |
|----------------------|-------------|---------|
| Render Web Service   | Standard    | $25     |
| Render PostgreSQL    | Standard    | $25     |
| Cloudinary           | Plus        | $89     |
| Sentry               | Team        | $26     |
| Twilio SMS           | Pay-as-go   | ~$50    |
| **Total**            |             | **~$215/mo** |

---

## 15. Configure EAS Secrets (Required Before Building)

The production build no longer hardcodes Supabase keys in `eas.json`. Instead, secrets are stored securely in EAS and injected at build time via `app.config.js`.

### Step-by-step

1. Install and log in to EAS CLI:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Initialize your EAS project (if not already done):
   ```bash
   cd haboba
   eas init
   ```
   This gives you a project ID. Copy it.

3. Store the project ID:
   ```bash
   eas secret:create --scope project --name EAS_PROJECT_ID --value "your-project-id-here"
   ```

4. Store the Supabase credentials:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL \
     --value "https://your-project.supabase.co"

   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
     --value "eyJhbGci..."
   ```

5. (Optional) Store RevenueCat keys when ready:
   ```bash
   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY \
     --value "appl_xxx"

   eas secret:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY \
     --value "goog_xxx"
   ```

6. Verify your secrets are stored:
   ```bash
   eas secret:list
   ```

### How it works

- `app.config.js` reads `process.env.EXPO_PUBLIC_SUPABASE_URL` at build time
- EAS injects the secrets into the build environment automatically
- Local development still uses the `.env` file in the project root
- Different build profiles (development, preview, production) can each use different secrets

### Update app.json placeholder

After running `eas init`, update the fallback in `app.config.js` line 44:

```js
projectId: process.env.EAS_PROJECT_ID || 'your-actual-project-id',
```

### Update Apple/Google submission IDs

In `eas.json`, replace these placeholders with real values:

| Placeholder | Where to Find It |
|---|---|
| `YOUR_ASC_APP_ID` | App Store Connect → your app → General → Apple ID (numeric) |
| `YOUR_APPLE_TEAM_ID` | developer.apple.com → Membership → Team ID |
| `google-services.json` | Google Play Console → Setup → API access → Create service account → download JSON key |

---

## 16. Set Up GitHub Actions CI/CD

A CI/CD pipeline is configured at `.github/workflows/ci.yml`. It runs tests on every PR and deploys on merge to `main`.

### What it does

```
Pull Request → main
├── test-frontend (runs jest, 33 tests)
├── test-backend  (runs jest against test PostgreSQL)
└── (blocked until both pass)

Merge to main
├── eas-build     (builds iOS + Android via EAS)
└── deploy-backend (triggers Render re-deploy)
```

### GitHub Secrets to configure

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret Name | Value | Where to Get It |
|---|---|---|
| `EXPO_TOKEN` | Personal access token | expo.dev → Account Settings → Access Tokens → Create |
| `RENDER_DEPLOY_HOOK_URL` | Deploy hook URL | Render dashboard → junubin-api → Settings → Deploy Hook → copy URL |

### Step-by-step

1. Push the repo to GitHub (if not already):
   ```bash
   cd /path/to/ss_haboba
   git remote add origin https://github.com/YOUR_USER/haboba.git
   git push -u origin main
   ```

2. Create the Expo token:
   - Go to https://expo.dev → click your avatar → **Access Tokens**
   - Click **Create Token** → name it `github-ci` → copy the token
   - Add it as a GitHub secret named `EXPO_TOKEN`

3. Create the Render deploy hook:
   - Go to https://dashboard.render.com → **junubin-api** → **Settings**
   - Scroll to **Deploy Hook** → click **Create Deploy Hook**
   - Copy the URL (looks like `https://api.render.com/deploy/srv-xxxxx?key=xxxxx`)
   - Add it as a GitHub secret named `RENDER_DEPLOY_HOOK_URL`

4. Verify the pipeline works:
   - Create a branch, make a small change, open a PR
   - The `test-frontend` and `test-backend` jobs should run
   - Merge the PR — the `eas-build` and `deploy-backend` jobs should trigger

### Backend CI database

The workflow spins up a temporary PostgreSQL 16 container for backend tests. No external database needed. The test database is destroyed after the job completes.

---

## 17. OTA Updates with EAS Update

After your app is published, you can push JavaScript-only updates without going through the App Store / Play Store review process.

### How channels work

| Channel | Build Profile | Purpose |
|---|---|---|
| `development` | `development` | Dev builds with Expo Dev Client |
| `preview` | `preview` | Internal testing (TestFlight-like) |
| `production` | `production` | Live users on App Store / Play Store |

### Push an OTA update

```bash
# Update preview testers
npm run update:preview -- --message "Fix match overlay animation"

# Update production users
npm run update:prod -- --message "Fix daily like counter display"
```

### What can be updated OTA

- JavaScript code changes (screens, components, logic)
- Asset changes (images, fonts referenced in JS)

### What requires a new native build

- New native modules (e.g., adding `expo-camera`)
- Changes to `app.config.js` native settings (bundle ID, permissions)
- Upgrading Expo SDK version
- Changes to `ios/` or `android/` directories

### Rollback an update

```bash
# List recent updates
eas update:list --channel production

# Roll back by publishing the previous update group
eas update:republish --group "previous-update-group-id"
```

---

## 18. Dynamic App Configuration

The app uses `app.config.js` (not `app.json`) for dynamic configuration. This allows:

- **Different bundle IDs per environment** — so dev, preview, and production builds can coexist on the same device
- **Environment-driven secrets** — Supabase keys, EAS project ID injected at build time
- **OTA update support** — runtime version policy and update URL configured automatically

### Build variants

| `APP_VARIANT` | App Name | Bundle ID |
|---|---|---|
| `development` | JuNubin (Dev) | `com.haboba.app.dev` |
| `preview` | JuNubin (Preview) | `com.haboba.app.preview` |
| `production` | JuNubin | `com.haboba.app` |

The variant is set automatically by the EAS build profile in `eas.json`.

### Local development

For local development, the `.env` file in the project root is used. Create it from the example:

```bash
cp .env.example .env
```

Then fill in your Supabase URL and anon key. The `app.config.js` reads these via `process.env.EXPO_PUBLIC_*` at build time.

---

## Quick Commands Reference

```bash
# ─── Secrets ────────────────────────────────
# Generate production JWT secret
openssl rand -hex 64

# Store an EAS secret
eas secret:create --scope project --name KEY_NAME --value "value"

# List all EAS secrets
eas secret:list

# ─── Backend ────────────────────────────────
# Test health check
curl https://junubin-api.onrender.com/v1/health

# Run database migrations manually (from backend/)
DATABASE_URL="your-production-url" npx prisma migrate deploy

# Seed database (from backend/)
DATABASE_URL="your-production-url" npm run prisma:seed

# Open Prisma Studio against production (be careful)
DATABASE_URL="your-external-db-url" npx prisma studio

# ─── Mobile App Builds ──────────────────────
# Development build (with dev client)
npm run build:dev

# Preview build (internal testing)
npm run build:preview

# Production build (App Store / Play Store)
npm run build:prod

# ─── Store Submission ───────────────────────
npm run submit:ios
npm run submit:android

# ─── OTA Updates (no store review needed) ───
npm run update:preview -- --message "description of changes"
npm run update:prod -- --message "description of changes"

# ─── Monitoring ─────────────────────────────
# View Render logs
# Go to: dashboard.render.com → junubin-api → Logs

# Check database size
# Go to: dashboard.render.com → junubin-db → Metrics
```
