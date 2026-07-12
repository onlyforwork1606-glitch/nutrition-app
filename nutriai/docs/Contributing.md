# Contributing to NutriAI

Thanks for helping! This repo has two parts:

- `nutriai/` — the React PWA frontend (`npm run dev`, `npm run build`).
- `nutriai/worker/` — the Cloudflare Worker API (`wrangler dev`, `wrangler deploy`).

## Rules
- **Keep the OpenRouter key server-side.** It goes in `wrangler secret put`,
  never in a `VITE_` env var.
- **Type safety:** both projects use TypeScript strict mode. Run
  `npm run typecheck` (frontend) and `npx tsc --noEmit` (worker) before PRs.
- **No UI/UX changes** without discussion — the brief is to keep the existing
  glassmorphism design.
- Validate all external input with Zod on the server.

## Workflow
1. Fork / branch from `main`.
2. Make changes, add tests where practical.
3. Ensure both typechecks pass (CI runs them).
4. Open a PR with a short description of the change and its security impact.

## Local setup
See `docs/Deployment.md` → “Local development”.
