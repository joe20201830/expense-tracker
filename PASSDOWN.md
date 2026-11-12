# Expense Tracker — Passdown

## Status

Production is running commit `4449c24`, verified 2026-11-12.

- Production: https://expense-tracker-sepia-psi-86.vercel.app/
- Repo: `joe20201830/expense-tracker` (private), branch `main`
- Run locally: `PORT=3003 node server.js`

The Add tab has a read-only category guide and an Apple Pay draft review area. Pending transactions use the `ApplePayDrafts` tab of the existing Google Sheet, created on the first draft. They enter `Sheet1` and spending totals only after finalization. See `APPLE_PAY_SETUP.md` for iPhone Shortcut setup.

Live checks passed for `/`, `/manifest.json`, and `/sw.js` (HTTP 200). Unauthenticated requests to `/api/expenses/all` and `/api/apple-pay-drafts` return HTTP 401, confirming the Production `API_TOKEN` is active. Draft create/list/update/finalize passed a mock-sheet test; no live draft or expense was created during verification.

## Unresolved

The user needs to configure the iPhone Transaction automation, then test one real Wallet payment and review/finalization. The live authenticated draft flow has not been tested yet because the token is user-held.

## Watchouts

- Read the Deployment section of `CLAUDE.md` before touching `vercel.json` or the function routes. Two separate mistakes there each broke production once.
- `Design Reference*.webp` is gitignored; the theme reference images are deliberately kept out of the repo.
- Recurring items live in browser localStorage, not Google Sheets. Existing items have no payment method until edited.
- Apple Pay drafts require `API_TOKEN`; do not put it in Git or chat.

## Next Step

Follow `APPLE_PAY_SETUP.md` on the iPhone. Check that a Wallet tap creates one pending draft with the expected amount, date, merchant, and payment method; then finalize it and verify it appears once in History.
