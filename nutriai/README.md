# NutriAI — Snap. Eat. Track.

An AI-powered, mobile-first calorie & nutrition tracker. Snap a photo of your food
and a vision model estimates the items, portion, calories and macros, saving them
into a daily journal. A separate coaching model acts as your personal nutrition
coach. Works fully offline (data stored in your browser) and installs as a PWA.

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS v4
- **UI:** shadcn-style glassmorphism components, Framer Motion, lucide icons
- **Routing:** TanStack Router · **Data:** TanStack Query
- **Charts:** Recharts · **3D:** Three.js (`@react-three/fiber` + `drei`)
- **Storage:** IndexedDB (`idb`) + localStorage-style KV
- **AI:** OpenRouter (`gemma-4-26b` vision + `qwen3-next-80b` coach)
- **Deploy:** Cloudflare Pages · **PWA:** installable, offline, auto-update

## Getting started

```bash
npm install
npm run dev
```

The app runs fully client-side against the OpenRouter **key stored on the
Worker**. For local development, point it at a local Worker via
`VITE_API_BASE=http://localhost:8787` (see `docs/Deployment.md`).

Open http://localhost:5173.

### OpenRouter key (server-side only)

The OpenRouter key is a **secret managed by the Cloudflare Worker** and is
**never** exposed to the browser. It is set with
`wrangler secret put OPENROUTER_API_KEY` (see `docs/Deployment.md`). The frontend
talks only to the Worker API (`/api/vision`, `/api/coach`, …); the Worker calls
OpenRouter with the key. No `VITE_`-prefixed key exists in the client bundle.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |
| `npm run deploy` | Deploy `dist/` to Cloudflare Pages |

## Architecture

The app is a client-first PWA backed by a Cloudflare-native serverless API. The
browser never talks to OpenRouter directly.

```
nutriai/                 React PWA (this repo)
  src/lib/api.ts         apiClient — calls the Worker API (/api/*)
  src/lib/ai.ts          AIService — proxies vision + coach to the Worker
  src/lib/db.ts          IndexedDB (offline-first local cache)
  worker/                Cloudflare Worker (Hono)
    src/index.ts         routes + scheduled reports
    src/middleware.ts    auth (signed cookie), rate limit (KV), security headers
    src/services/        openrouter, nutrition, coach, db (D1)
    migrations/          D1 schema
```

The full design, API, database, deployment and security notes live in [`docs/`](./docs):

- [Architecture](./docs/Architecture.md)
- [API](./docs/API.md)
- [Database](./docs/Database.md)
- [Deployment](./docs/Deployment.md)
- [Security](./docs/Security.md)

### AI models (configurable in `worker/src/config.ts` and `src/lib/constants.ts`)

- **Vision** — `google/gemma-4-26b-a4b-it:free` — food recognition + macro estimation.
  Falls back to `nvidia/nemotron-nano-12b-v2-vl:free`.
- **Coach** — `google/gemma-4-26b-a4b-it:free` — daily/weekly/monthly coaching + chat.
  Falls back to `nvidia/nemotron-nano-12b-v2-vl:free` then `meta-llama/llama-3.3-70b-instruct:free`.

Vision results are reconciled against a curated `food_db` (D1) so reported macros
come from real nutrition data, not model hallucination.

## Deployment (Cloudflare Pages + Worker)

1. Build: `npm run build` (outputs to `dist/`).
2. Deploy the Worker: `cd worker && wrangler deploy` (see `docs/Deployment.md`).
3. Deploy the PWA: `wrangler pages deploy dist` and set `VITE_API_BASE` to the
   Worker URL.

Full step-by-step walkthrough: [docs/Deployment.md](./docs/Deployment.md).

## Features

Home · Scan (camera/gallery → AI) · Diary (edit/delete, water tracker, quick-add)
· Progress (calorie/protein/weight charts, macro pie, weight prediction)
· Settings (goals, API key, export/import) · Floating AI Coach · PWA.
