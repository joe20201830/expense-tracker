# Expense Tracker — Passdown

## Status
Deployed and healthy. No known open bugs. Verified live 2026-10-05.

- Production: https://expense-tracker-sepia-psi-86.vercel.app/
- Repo: `joe20201830/expense-tracker` (private), branch `main`
- This file is tracked in git; run `git log -3 --oneline` for commits since it was written.

Live check passed for `/`, `/manifest.json`, `/sw.js`, and `/api/expenses/all`; the app loads real Sheet data.

## Deployment Notes — read before touching routing
`vercel.json` rewrites `/manifest.json`, `/sw.js`, `/icon.png`, and `/icon.svg` to `/api/*`. The Vercel function at `api/[...path].js` re-exports the handler from `server.js`.

Two traps that each broke production once:

1. Vercel only bundles files it can trace from literal paths. `server.js` resolves assets through the explicit `getStaticFile()` switch so `index.html`, `manifest.json`, `sw.js`, and the icons ship inside the function. Keep those paths literal.
2. Do not use the bracketed filename `api/[...path].js` as a key inside the `functions` block of `vercel.json`. Vercel reads `[...path]` as a glob, matches nothing, and fails the build.

`sw.js` uses network-first caching so stale pages self-clear; bump `CACHE` whenever its logic changes.

## Next Agent — Start Here
Read `CLAUDE.md` for architecture, env vars, and the Sheet schema. Server runs on port 3003; Google Sheets access uses `./credentials.json` locally or `GOOGLE_SERVICE_ACCOUNT_KEY` in production.

Run locally with `PORT=3003 node server.js`. The frontend calls `/api/...`, and the handler strips the `/api` prefix, so the same code serves both local and Vercel.

There is no pending task queue. Ask the user what to work on next.

## Local Housekeeping
- `icon.svg` is deleted in the working tree but still present in the deployed commit, so production serves it and local does not.
- `Design Reference.webp` and `Design Reference 2.webp` are untracked reference images.
- No automated tests. Verification is manual checks plus syntax validation.
