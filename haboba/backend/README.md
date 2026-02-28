# JuNubin Backend

Production-ready backend scaffold for JuNubin (global dating app):
- Node.js + Express API
- PostgreSQL + Prisma ORM
- JWT auth
- Discover, swipes, matches, and conversation APIs

## 1) Local Setup

1. Copy env file:
```bash
cp .env.example .env
```

2. Start Postgres:
```bash
docker compose up -d
```

3. Install dependencies:
```bash
npm install
```

4. Generate Prisma client and migrate:
```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
```

5. Start API:
```bash
npm run dev
```

API base URL:
`http://localhost:4000/v1`

## OTP Dev Login (for current mobile flow)

- Start OTP: `POST /v1/auth/otp/start` with `{ "email": "..."} ` or `{ "phone": "..."}`
- Verify OTP: `POST /v1/auth/otp/verify` with same email/phone + `code`
- Dev code: `123456`

This is a development OTP flow. For production global launch, replace with provider-backed OTP (Twilio/MessageBird/WhatsApp + email OTP provider).

## 2) Core Endpoints

- `GET /v1/health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `GET /v1/auth/me`
- `GET /v1/discover?minAge=21&maxAge=35&limit=20`
- `POST /v1/swipes`
- `GET /v1/matches`
- `GET /v1/conversations/:conversationId/messages`
- `POST /v1/conversations/:conversationId/messages`
- `PATCH /v1/users/me`

## 3) Global Deployment (Recommended)

For global availability and low latency:

1. Regions:
- Deploy API in at least 3 regions (US, EU, Africa/MEA).
- Use regional stateless app instances.

2. Database:
- Use managed Postgres with primary + read replicas.
- Keep writes on primary region; route read-heavy endpoints to replicas.
- Add PgBouncer for connection pooling.

3. Edge + Routing:
- Put API behind Cloudflare/AWS Global Accelerator.
- Route users to nearest region; fail over automatically.

4. Storage:
- Store media in object storage (S3/R2/GCS) with global CDN.

5. Security:
- Rotate JWT secrets via secret manager.
- Add rate limiting and abuse detection.
- Enable structured audit logs for moderation.

6. Reliability:
- Add background jobs for notifications and async matching workflows.
- Add observability (OpenTelemetry + logs + metrics + tracing).

## 4) Notes

- This scaffold is API-first and ready for mobile integration.
- Replace local JWT-only auth with full refresh-token rotation + device session policies before production launch.
- Refresh-token endpoints already included: `POST /v1/auth/refresh`, `POST /v1/auth/logout`.
