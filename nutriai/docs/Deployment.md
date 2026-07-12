# NutriAI — Deployment

This walkthrough deploys NutriAI to Cloudflare: a Worker API + D1 + R2 + KV,
and the React PWA on Cloudflare Pages.

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

Edit `wrangler.toml` `[vars]`:
- `R2_PUBLIC_URL` → your R2 public URL (`https://pub-<hash>.r2.dev` or a
  custom domain).
- `FRONTEND_URL` → your Pages URL.
- `GOOGLE_REDIRECT_URI` → `https://<api-domain>/api/auth/google/callback`.

## 3. Deploy the Worker

```bash
wrangler deploy
# note the worker URL, e.g. https://nutriai-api.<sub>.workers.dev
```

## 4. Build & deploy the frontend (Pages)

```bash
cd ..
# point the client at the Worker API (or leave empty for same-origin Functions)
echo "VITE_API_BASE=https://nutriai-api.<sub>.workers.dev" > .env.production

npm run build
wrangler pages deploy dist
```

In the Pages dashboard, set the same `VITE_API_BASE` as a build environment
variable. Set the Pages custom domain (e.g. `nutriai.pages.dev`).

## 5. Wire custom domains (recommended)
- Pages: `nutriai.app` (frontend).
- Worker: `api.nutriai.app` (API). Update `FRONTEND_URL` / `R2_PUBLIC_URL`
  accordingly and redeploy.
- Enable R2 public access or a custom domain for meal images.

## 6. Verify
- Open the app → Settings → AI Status → “Check” should show **Online**.
- Scan a meal → foods appear.
- Ask the coach a question → it replies using your logged data.

## Local development

```bash
# Worker (terminal 1)
cd worker && cp .dev.vars.example .dev.vars && wrangler dev

# Frontend (terminal 2)
cd .. && npm run dev
# set VITE_API_BASE=http://localhost:8787 in .env for local API
```

## Cron notes
Cron triggers run on the deployed Worker only. Weekly/monthly reports are
generated for non-anonymous users and stored as coach messages.
