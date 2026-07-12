# Cloudflare Dashboard Deployment (Git)

This project deploys as a **single Cloudflare Worker** that serves both the PWA
(static assets) and the `/api/*` backend. You can deploy it purely from the
Cloudflare Dashboard by connecting the GitHub repo — **no manual build steps
and no file copying**.

## Monorepo structure

```
nutriai/                 ← repo root = frontend (Vite PWA)
├─ package.json          ← controls the whole build (workspaces)
├─ src/                  ← React app
├─ dist/                 ← built PWA (generated)
├─ worker/               ← Cloudflare Worker
│  ├─ wrangler.toml      ← Worker config: bindings + static assets (../dist)
│  ├─ package.json       ← `build` script builds the frontend in `..`
│  └─ src/
└─ docs/
```

- `npm workspaces` links `worker` to the root.
- Root `npm run build` builds the frontend into `dist/`.
- Worker `build` script (`npm --prefix .. install && npm --prefix .. run build`)
  builds the frontend from inside `worker/` so the Dashboard can call it.
- `worker/wrangler.toml` sets `assets.directory = "../dist"` and
  `not_found_handling = "single-page-application"`.

## One-time resource setup (run locally once)

The Dashboard reads `wrangler.toml`, but the bindings must exist first:

```bash
cd worker
wrangler d1 create nutriai
wrangler r2 bucket create nutriai-images
wrangler kv namespace create KV
wrangler d1 execute nutriai --remote --file=migrations/0001_init.sql
```

Paste the **D1 database_id** and **KV id** into `worker/wrangler.toml`.

## Exact Cloudflare Dashboard settings

1. **Workers & Pages → Create → Connect to Git**.
2. Choose the GitHub repository.
3. Fill in exactly:

| Field | Value |
| --- | --- |
| **Product** | Workers |
| **Repository** | `<your-org>/<repo>` |
| **Root directory** | `worker` |
| **Build command** | `npm install && npm run build` |
| **Deploy command** | _(leave default — Dashboard runs `wrangler deploy`)_ |
| **Environment (Production)** | Production |
| **Compatibility date** | `2024-11-01` |
| **Compatibility flags** | `nodejs_compat` |

The Dashboard runs `npm install && npm run build` **inside `worker/`**, which
builds the frontend into `../dist`, then automatically runs `wrangler deploy`
using `worker/wrangler.toml` (which serves `../dist` as static assets).

### Environment variables (`[vars]`)

Set these in **Settings → Variables and Secrets → Production**:

| Variable | Example value |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `R2_PUBLIC_URL` | `https://pub-<hash>.r2.dev` |
| `FRONTEND_URL` | `https://nutriai.<sub>.workers.dev` |
| `GOOGLE_REDIRECT_URI` | `https://nutriai.<sub>.workers.dev/api/auth/google/callback` |

### Secrets

Add as **encrypted secrets** (never commit):

| Secret | Notes |
| --- | --- |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | optional |
| `GOOGLE_CLIENT_SECRET` | optional |
| `USDA_API_KEY` | optional |
| `SENTRY_DSN` | optional (enables production error monitoring) |

### Bindings (defined in `wrangler.toml`)

The Dashboard will provision these from `wrangler.toml` on first deploy:

- **D1**: `DB` → `nutriai`
- **R2**: `IMAGES` → `nutriai-images`
- **KV**: `KV`
- **Durable Object**: `COACH_DO` (class `CoachDurable`)
- **Cron Triggers**: `0 9 * * 1` (weekly), `0 9 1 * *` (monthly)

### Static assets

No dashboard field — configured in `wrangler.toml`:

```toml
[assets]
directory = "../dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
```

## GitHub deployment settings

- Push to **`main`** → the Dashboard automatically builds and deploys to
  Production.
- Pull requests → the Dashboard creates **preview deployments**
  automatically.
- No GitHub secrets are required (the keys above are Cloudflare secrets, not
  GitHub secrets). `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` are only
  needed for the CLI / GitHub Actions approach, not the Dashboard Git flow.

## Local / manual deploy

```bash
npm install        # installs root + worker (workspaces)
npm run build      # builds the frontend
npm run deploy     # builds + `wrangler deploy --config worker/wrangler.toml`
```

## CI

`.github/workflows/ci.yml` runs lint + typecheck + test + build on every push.
It does **not** deploy — deployment is owned by the Dashboard, so there is no
double-deploy.
