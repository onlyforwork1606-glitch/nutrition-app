# NutriAI — Deployment

This walkthrough deploys NutriAI to Cloudflare as a **single Worker** that
serves both the React PWA (static assets) and the `/api/*` backend (Hono),
using D1 + R2 + KV. The API and the app share one domain.

## 0. Prerequisites
- A Cloudflare account (free tier works).
- `npm i -g wrangler` (or use `npx wrangler`).
- An OpenRouter key: https://openrouter.ai/keys
- (Optional) a Google OAuth client for login.

## 1. Create the resources

```bash
cd worker
wrangler login

# D1 database
wrangler d1 create nutriai
# -> copy the returned database_id into wrangler.toml (d1_databases.database_id)

# R2 bucket
wrangler r2 bucket create nutriai-images

# KV namespace
wrangler kv namespace create KV
# -> copy the id into wrangler.toml (kv_namespaces.id)

# Apply the schema
wrangler d1 execute nutriai --local --file=migrations/0001_init.sql
wrangler d1 execute nutriai --remote --file=migrations/0001_init.sql
```

## 2. Secrets (never commit these)

```bash
wrangler secret put OPENROUTER_API_KEY
wrangler secret put SESSION_SECRET          # openssl rand -hex 32
wrangler secret put GOOGLE_CLIENT_ID        # optional
wrangler secret put GOOGLE_CLIENT_SECRET    # optional
wrangler secret put USDA_API_KEY            # optional
```

The remaining variables (`ENVIRONMENT`, `OPENROUTER_BASE_URL`) are already set
in `wrangler.toml` `[vars]`. The following are **no longer configured** — they
are derived at runtime: `R2_PUBLIC_URL` (images are served from the Worker
origin at `/api/images/:key`), `FRONTEND_URL`, and `GOOGLE_REDIRECT_URI` (both
derived from the incoming request's origin).

> For a Dashboard Git deployment, D1 (`DB`) and KV (`KV`) are bound in the
> Cloudflare Dashboard rather than listed in `wrangler.toml`. See
> `docs/Cloudflare-Deployment.md`.

## 3. Build the frontend, then deploy the single Worker

The Worker serves the PWA from `../dist` (built by `npm run build`) and the
API from `/api/*`. No `VITE_API_BASE` is needed — the app and API are
same-origin.

```bash
cd ..
npm run build                 # outputs to nutriai/dist
cd worker
wrangler deploy               # deploys Worker + static assets
# the app is live at https://nutriai.<your-subdomain>.workers.dev
```

(One-command equivalent from the repo root: `npm run deploy`.)

## 4. Wire a custom domain (recommended)

Set a custom domain for the Worker (e.g. `nutriai.app`) in the Cloudflare
dashboard. No `wrangler.toml` edits are required — the Google OAuth
`redirect_uri` and image URLs are generated from the request origin, so they
pick up the custom domain automatically.

Redeploy with `wrangler deploy`.

## 5. Verify
- Open the app → Settings → AI Status → “Check” should show **Online**.
- Scan a meal → foods appear.
- Ask the coach a question → it replies using your logged data.

## Local development

```bash
# Build assets once (or run `npm run dev` in a second terminal for HMR)
cd .. && npm run build

# Worker + assets (terminal 1)
cd worker && cp .dev.vars.example .dev.vars && wrangler dev

# Frontend HMR (terminal 2) — point the client at the local Worker
cd .. && echo "VITE_API_BASE=http://localhost:8787" > .env
npm run dev
```

## Cron notes
Cron triggers run on the deployed Worker only. Weekly/monthly reports are
generated for non-anonymous users and stored as coach messages.
