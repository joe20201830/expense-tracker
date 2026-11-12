# Expense Tracker — Passdown

## Status
Deployed and healthy. No known open bugs. Verified live 2026-10-22.

- Production: https://expense-tracker-sepia-psi-86.vercel.app/
- Repo: `joe20201830/expense-tracker` (private), branch `main`
- Run locally: `PORT=3003 node server.js`

Commit `41c5dea` is deployed: the Add tab shows spending for the last 14 calendar days including today and compares it with the preceding 14 days; History has subtle dividers between dates; Recurring items have a payment method and a Delete button inside the edit form. The user confirmed the updated UI looks good. Live checks passed for `/`, `/manifest.json`, `/sw.js`, and `/api/expenses/all` (HTTP 200).

## Unresolved

Apple Pay draft capture is implemented locally in `server.js` and `index.html`, with setup steps in `APPLE_PAY_SETUP.md`. It has not been committed or deployed. Production currently returns HTTP 200 for `/api/expenses/all` without a token, so `API_TOKEN` must be configured in Vercel before the draft feature can be used securely. The draft routes return 503 when that token is absent. User still needs to configure and test the iPhone Transaction automation.

## Watchouts

- Read the Deployment section of `CLAUDE.md` before touching `vercel.json` or the function routes. Two separate mistakes there each broke production once.
- `Design Reference*.webp` is gitignored; the theme reference images are deliberately kept out of the repo.
- No automated tests. Verify with manual checks plus `node --check`.
- Recurring items live in browser localStorage, not Google Sheets. Existing items have no payment method until edited.

## Next Step

Configure the production `API_TOKEN`, deploy the code after user approval to commit, then test one Wallet transaction and finalization on the iPhone.
