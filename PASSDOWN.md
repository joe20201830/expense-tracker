# Expense Tracker — Passdown

## Status
Deployed and healthy. No known open bugs. Verified live 2026-10-05.

- Production: https://expense-tracker-sepia-psi-86.vercel.app/
- Repo: `joe20201830/expense-tracker` (private), branch `main`
- Run locally: `PORT=3003 node server.js`

Live check passed for `/`, `/manifest.json`, `/sw.js`, and `/api/expenses/all`; the app loads real Sheet data.

## Unresolved

No pending task queue. Ask the user what to work on next.

## Watchouts

- Read the Deployment section of `CLAUDE.md` before touching `vercel.json` or the function routes. Two separate mistakes there each broke production once.
- `Design Reference*.webp` is gitignored; the theme reference images are deliberately kept out of the repo.
- No automated tests. Verify with manual checks plus `node --check`.

## Next Step

Read `CLAUDE.md` for architecture, env vars, and the Sheet schema.
