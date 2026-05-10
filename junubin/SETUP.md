# Setup

> **Note:** the previous version of this file (~900 lines) documented an Express + Prisma + Render + Cloudinary backend that no longer exists. The app now talks to Supabase directly. The relevant getting-started, deployment, and secrets-management instructions live in [README.md](README.md).

## Quick links

- **Local dev setup** — [README.md → Getting Started](README.md#getting-started)
- **Database migrations** — [README.md → Apply database migrations](README.md#3-apply-database-migrations)
- **Edge function secrets** — [README.md → Set Edge Function secrets](README.md#4-set-edge-function-secrets-server-side-only)
- **Deploying functions** — [README.md → Deploy Edge Functions](README.md#5-deploy-edge-functions)
- **Mobile build + submit** — [README.md → Deployment](README.md#deployment)

## What changed

The Express backend, the `payments` table (lowercase), Render config, Cloudinary, and the JWT/Socket.IO real-time stack have all been removed. Their replacements:

| Removed | Replacement |
|---|---|
| Express routes (`/v1/*`) | Direct Supabase queries via `@supabase/supabase-js` + Edge Functions |
| Prisma migrations | Supabase migrations under `supabase/migrations/` |
| Render Postgres | Supabase Postgres |
| JWT + bcrypt | Supabase Auth (OTP) |
| Socket.IO + JWT handshake | Supabase Realtime postgres-changes |
| Cloudinary | Supabase Storage (`photos`, `posts`, `stories` buckets) |
| `payments` table (Flutterwave) | Canonical `Payment` table (00009) — discriminated by `(provider, providerRef)` |
