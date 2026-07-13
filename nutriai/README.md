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
- **Storage:** IndexedDB (`idb`) — all your data lives in your browser
- **AI:** OpenRouter via Cloudflare Pages Functions (key stays server-side)
- **Deploy:** Cloudflare Pages · **PWA:** installable, offline, auto-update

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app runs fully client-side. The only server-side
logic is a thin Cloudflare Pages Functions layer that proxies AI calls to
OpenRouter (so your API key never reaches the browser).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (static PWA) |
| `npm run build` | Type-check + production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run typecheck` | `tsc` type-check |

## Architecture

A **static Cloudflare Pages site** (the React PWA) plus **Pages Functions**
(`functions/api/*`) that only proxy to OpenRouter. The browser never talks to
OpenRouter directly and never sees the API key.

```
nutriai/
  src/                     React PWA
    lib/api.ts             apiClient — calls the Pages Functions (/api/*)
    lib/ai.ts              AIService — vision + coach helpers
    lib/db.ts              IndexedDB (offline-first local store)
    routes/                pages (scan, diary, progress, coach, settings)
  functions/
    api/_openrouter.ts     shared OpenRouter client + prompts (not a route)
    api/vision.ts          POST /api/vision  → food recognition
    api/chat.ts            POST /api/chat    → nutrition coach
    api/health.ts          GET  /api/health  → key-availability check
```

### AI models (configurable in `functions/api/_openrouter.ts`)

- **Vision** — `google/gemma-4-26b-a4b-it:free` — food recognition + macro
  estimation. Falls back to `nvidia/nemotron-nano-12b-v2-vl:free`.
- **Coach** — `google/gemma-4-26b-a4b-it:free` — daily/weekly/monthly coaching
  + chat. Falls back to `nvidia/nemotron-nano-12b-v2-vl:free` then
  `meta-llama/llama-3.3-70b-instruct:free`.

## Deployment (Cloudflare Pages — GitHub integration)

Requires **exactly one** environment variable: `OPENROUTER_API_KEY`.

1. Push this repo to GitHub.
2. In the Cloudflare Dashboard, create a **Pages** project and connect the repo.
3. Build settings:
   - **Build command:** `npm run build` (run in the `nutriai/` directory, or set
     the project root to `nutriai/`)
   - **Build output directory:** `dist`
4. Add the environment variable `OPENROUTER_API_KEY` (your key from
   https://openrouter.ai/keys) under **Settings → Environment variables** (both
   Production and Preview).
5. Save & deploy. Pages builds and deploys automatically on every push — no
   Wrangler or extra tooling required.

The `functions/` folder is detected automatically by Pages; the API routes
(`/api/vision`, `/api/chat`, `/api/health`) are served from the same origin as
the static site.

## Features

Home · Scan (camera/gallery → AI) · Diary (edit/delete, water tracker, quick-add)
· Progress (calorie/protein/weight charts, macro pie, weight prediction)
· Settings (goals, export/import) · Floating AI Coach · PWA (installable, offline).
