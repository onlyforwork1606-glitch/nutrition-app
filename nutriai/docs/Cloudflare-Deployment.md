# Cloudflare Dashboard Deployment (Git)

This project deploys as a **single Cloudflare Worker** that serves both the PWA
(static assets) and the `/api/*` backend. You can deploy it purely from the
Cloudflare Dashboard by connecting the GitHub repo — **no manual editing of
`wrangler.toml` and no file copying**.

## Why there are no resource IDs in `wrangler.toml`

`wrangler.toml` is the source of truth for a Git deployment, but resource IDs
(D1 `database_id`, KV `id`) only exist **after** you create the resource. To
keep the repo commitment-ready and free of placeholders, the following bindings
are **created and attached in the Cloudflare Dashboard** (not hard-coded):

- **D1** database — binding name `DB`
- **KV** namespace — binding name `KV`

The bindings that need no ID are already declared in `wrangler.toml`:

- **R2** bucket — `IMAGES` → `nutriai-images` (by `bucket_name`)
- **Durable Object** — `COACH_DO` (class `CoachDurable`)
- **Assets** — the built PWA from `../dist`
- **Cron Triggers** — weekly + monthly reports

The D1 schema **self-initializes** on the first request
(`src/services/db.ts` runs `CREATE TABLE IF NOT EXISTS` for every table), so no
separate migration step is required at deploy time.

> The Worker name in `wrangler.toml` is `nutriai`. Create the Cloudflare
> Workers project with the **same name** to avoid the "Worker name mismatch"
> warning.

## Monorepo structure

```
nutriai/                 ← repo root = frontend (Vite PWA)
├─ package.json          ← controls the whole build (npm workspaces)
├─ src/                  ← React app
├─ dist/                 ← built PWA (generated)
├─ worker/               ← Cloudflare Worker
│  ├─ wrangler.toml      ← Worker config: R2/DO/Assets + static assets (../dist)
│  ├─ package.json       ← `build` script builds the frontend in `..`
│  └─ src/
└─ docs/
```

- `npm workspaces` links `worker` to the root.
- Root `npm run build` builds the frontend into `dist/`.
- Worker `build` script builds the frontend from inside `worker/` so the
  Dashboard can call it.
- `worker/wrangler.toml` sets `assets.directory = "../dist"` and
  `not_found_handling = "single-page-application"`.

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

4. **Create the Worker project named `nutriai`** (matches `wrangler.toml`).

The Dashboard runs `npm install && npm run build` **inside `worker/`**, which
builds the frontend into `../dist`, then automatically runs `wrangler deploy`
using `worker/wrangler.toml` (which serves `../dist` as static assets).

## Create and bind resources (Dashboard)

Do this once, in the Dashboard, **before or after** the first deploy (the app
boots fine without them and starts using them once bound):

1. **D1** — *Workers & Pages → nutriai → Settings → Variables and Secrets →
   Add → D1 database*. Create a database named **`nutriai`** and bind it with
   the binding name **`DB`**.
2. **KV** — same page → *Add → KV namespace*. Create a namespace (any name)
   and bind it with the binding name **`KV`** (used for rate limiting and OAuth
   state). If you skip this, the app still works and treats KV as a no-op.
3. **R2** — *R2 → Create bucket*, name it **`nutriai-images`**. The
   `wrangler.toml` `[r2_buckets]` entry already binds it as `IMAGES` by bucket
   name, so no ID is needed. (Durable Objects `COACH_DO` and Assets/cron are
   already declared in `wrangler.toml`.)

> Tip: you can also create these from the CLI and then bind in the Dashboard:
> `wrangler d1 create nutriai`, `wrangler kv namespace create KV`,
> `wrangler r2 bucket create nutriai-images`. The IDs stay in the Dashboard,
> never in the repo.

## Secrets & variables

Add as **encrypted secrets** (never commit) in *Settings → Variables and
Secrets → Production*:

| Secret | Notes |
| --- | --- |
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | optional (enables Google login) |
| `GOOGLE_CLIENT_SECRET` | optional |
| `USDA_API_KEY` | optional (enables USDA food lookups) |
| `SENTRY_DSN` | optional (enables production error monitoring) |

The only **variables** (`[vars]`) are already in `wrangler.toml`:

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |

The following are **no longer needed** — they are derived at runtime:
`R2_PUBLIC_URL` (images are served from the Worker origin at
`/api/images/:key`), `FRONTEND_URL`, and `GOOGLE_REDIRECT_URI` (both derived
from the incoming request's origin).

## Local / manual deploy

```bash
npm install        # installs root + worker (workspaces)
npm run build      # builds the frontend
npm run deploy     # builds + `wrangler deploy --config worker/wrangler.toml`
```

For local development, copy `worker/.dev.vars.example` to `worker/.dev.vars`
and fill in the secrets. Local D1/KV/R2 are wired through `wrangler dev`.

## CI

`.github/workflows/ci.yml` runs lint + typecheck + frontend tests + build, plus
worker typecheck + worker tests, on every push. It does **not** deploy —
deployment is owned by the Dashboard, so there is no double-deploy.
