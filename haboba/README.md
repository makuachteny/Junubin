# Haboba (JuNubin)

A dating app built for the South Sudanese diaspora community. React Native (Expo) frontend with an Express + Prisma + PostgreSQL backend.

## Tech Stack

**Frontend:** React Native 0.81, Expo SDK 54, React 19, React Navigation 7, Reanimated 4, Socket.IO Client

**Backend:** Node.js (ESM), Express 4, Prisma ORM, PostgreSQL 16, Socket.IO, Zod validation, JWT auth, Cloudinary (photo uploads)

## Project Structure

```
haboba/
├── App.js                     # Entry point — fonts, auth, theme, navigation
├── src/
│   ├── api/
│   │   ├── client.js          # Authenticated HTTP client with timeout + refresh
│   │   ├── hooks/useSocket.js # Socket.IO hook for real-time chat
│   │   └── services/          # profileService, discoverService, chatService, etc.
│   ├── auth/AuthContext.js     # JWT auth state, OTP login, token refresh
│   ├── components/            # ProfileCard, ActionButtons, FilterBar, etc.
│   ├── config/api.js          # API_BASE_URL (env-configurable)
│   ├── data/mockProfiles.js   # Mock data + imageSource utility re-export
│   ├── navigation/            # Stack + tab navigation
│   ├── payments/              # Subscription tiers, entitlements, purchase modal
│   ├── screens/               # 20+ screens (Home, Chat, Profile, Settings, etc.)
│   ├── theme/                 # Palettes, fonts, responsive sizing, shadows
│   └── utils/                 # imageSource, formatTime helpers
├── backend/
│   ├── src/
│   │   ├── app.js             # Express app — CORS, rate limiting, routes, error handler
│   │   ├── server.js          # HTTP + Socket.IO server with JWT auth
│   │   ├── config/env.js      # Environment validation
│   │   ├── middleware/auth.js  # JWT verification middleware
│   │   ├── routes/            # auth, users, discover, swipes, matches, conversations, photos
│   │   └── utils/             # cloudinary, pairKey, asyncHandler
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Seed script with 13 sample profiles
│   └── docker-compose.yml     # PostgreSQL 16
└── assets/                    # App icon, splash, fonts, profile images
```

## Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android emulator, or Expo Go on a physical device

## Getting Started

### 1. Install dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install
```

### 2. Start PostgreSQL

```bash
cd backend
docker compose up -d
```

### 3. Configure environment

```bash
cd backend
cp .env.example .env
# Edit .env — set JWT_SECRET to a random 32+ char string
# DATABASE_URL default works with the Docker setup
```

Required env vars:
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) |

Optional:
| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Backend port |
| `CORS_ORIGIN` | `*` | Allowed origins (comma-separated) |
| `NODE_ENV` | `development` | `development` / `production` |
| `JWT_EXPIRES_IN` | `7d` | Token expiry duration |
| `CLOUDINARY_CLOUD_NAME` | — | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | — | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | — | Cloudinary API secret |

Frontend env (optional):
| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:4000/v1` | Backend API URL |

### 4. Run database migrations and seed

```bash
cd backend
npx prisma migrate dev
npx prisma db seed
```

### 5. Start the backend

```bash
cd backend
npm run dev     # nodemon with auto-reload
```

### 6. Start the frontend

```bash
npm start       # Expo dev server
# Then press 'i' for iOS, 'a' for Android, or scan QR with Expo Go
```

**Dev login:** OTP code is `123456` for any phone number.

## Testing

```bash
# Frontend tests (jest-expo, 32 tests)
npm test

# Backend tests (Jest + supertest, 23 tests)
cd backend && npm test

# Watch mode (frontend)
npm run test:watch
```

### E2E (Detox) setup

Detox is configured for both iOS Simulator and Android Emulator using Expo prebuild.

Prerequisites:
- Xcode + iOS Simulator (macOS) for iOS tests
- Android Studio + running AVD named `Pixel_7_API_34` for Android tests
- Install dev deps: `npm install`

Commands:

```bash
# iOS
npm run e2e:build:ios
npm run e2e:test:ios

# Android
npm run e2e:build:android
npm run e2e:test:android
```

Notes:
- `e2e:build:*` runs `expo prebuild` first, which generates native `ios/` and `android/` folders.
- E2E specs live under `e2e/` with a starter smoke test in `e2e/smoke.e2e.js`.

### Test coverage

| Area | Tests | What's covered |
|---|---|---|
| `utils/imageSource` | 5 | Null, number, string, object, unknown input handling |
| `utils/formatTime` | 5 | Falsy input, now, minutes, hours, days formatting |
| `api/profileService` | 4 | Null input, API→UI shape, no photos, no profile |
| `payments/entitlements` | 11 | Tier access, feature checks (likes, rewinds, filters, incognito) |
| `components/ProfileCard` | 7 | Render, verified badge, distance, swipe ref, intention, images, no-image fallback |
| `backend/pairKey` | 3 | Deterministic pair key generation |
| `backend/env` | 5 | Required var validation, defaults, optional overrides, export shape |
| `backend/app` | 15 | Health endpoint, 404, auth rejection, security headers, CORS, rate limiting |

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm test` | Run frontend tests |
| `npm run test:ci` | Run frontend tests in CI mode |
| `npm run e2e:build:ios` | Prebuild + compile iOS app for Detox |
| `npm run e2e:test:ios` | Run Detox tests on iOS simulator |
| `npm run e2e:build:android` | Prebuild + compile Android app for Detox |
| `npm run e2e:test:android` | Run Detox tests on Android emulator |
| `cd backend && npm run dev` | Start backend with auto-reload |
| `cd backend && npm start` | Start backend (production) |
| `cd backend && npm test` | Run backend tests |
| `cd backend && npx prisma studio` | Open Prisma Studio (DB browser) |
| `cd backend && npx prisma migrate dev` | Create/apply migrations |

## Architecture Notes

**Auth flow:** Phone number → OTP → JWT access token stored in AsyncStorage. The `AuthContext` handles token refresh on 401 responses automatically.

**Real-time chat:** Socket.IO with JWT authentication. Events: `JOIN_CONVERSATION`, `SEND_MESSAGE`, `TYPING_START/STOP`, `READ_RECEIPT`, `MATCH_CREATED`.

**Image handling:** The `imageSource()` utility normalizes images across the app — handles `require()` numbers (local assets), URL strings (API), and `{ uri }` objects for React Native `<Image>` sources.

**Subscription tiers:** Free → Gold → Royal → Crown. Entitlements checked via pure functions in `src/payments/entitlements.js`.

**Security hardening:**
- Global rate limiting (100 req/min) + auth-specific (10 req/min)
- OTP attempt tracking with lockout after 5 failed attempts
- HTML stripping on message input
- Request timeout (15s) on frontend
- Helmet security headers
- Production error sanitization

## Deployment

**Backend** — see `backend/render.yaml` for Render deployment config, or use the `backend/Dockerfile`.

```bash
# Production migration
cd backend && npx prisma migrate deploy

# Start
cd backend && npm start
```

**Frontend** — build with EAS or export static bundle:

```bash
npx expo export --platform ios
npx expo export --platform android
```

## License

Private — all rights reserved.
