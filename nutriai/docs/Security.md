# NutriAI — Security

## Secrets
- **OpenRouter key is server-side only.** It is a Cloudflare secret
  (`wrangler secret put OPENROUTER_API_KEY`). It must never be prefixed with
  `VITE_` or it would be bundled into the client.
- `SESSION_SECRET` signs session cookies (HS256). Generate with
  `openssl rand -hex 32` and rotate if leaked.

## Transport & headers
- All responses set `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a
  `default-src 'none'` CSP (API responses are non-document).
- CORS allows only the configured `FRONTEND_URL` and credentials.

## Authentication
- Sessions are signed, HttpOnly, Secure, `SameSite=Lax` cookies.
- Anonymous users are created automatically but isolated by `user_id`; one
  user cannot read another's data (every query is scoped by `user_id`).
- Google OAuth uses PKCE-style `state` stored in KV (10-min TTL) to prevent
  CSRF on the callback.

## Rate limiting (protecting the free tier)
- KV fixed windows: **20 requests/minute** and **50/day** (free) or
  **1000/day** (credited key). Exceeding returns `429`.
- Every outbound OpenRouter call counts against quota, including failures.

## Data handling
- Meal images are stored in R2 as **temporary** objects; they are not exposed
  publicly beyond the R2 public URL and should be purged by a cleanup job.
- Inputs are validated with Zod on the server; AI output is parsed and schema
  checked before use.
- Soft deletes (`deleted_at`) keep history recoverable without losing refs.

## Privacy
- Local IndexedDB holds the user's own data on-device for offline use.
- Server data is minimal: nutrition logs + chat. No third-party analytics
  beyond OpenRouter (which receives images/text for inference only).
