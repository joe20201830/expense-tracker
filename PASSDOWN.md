# Expense Tracker — Passdown

## Status

Production is running commit `a485978`, verified by loading the updated page on 2026-11-13.

- Production: https://expense-tracker-sepia-psi-86.vercel.app/
- Repo: `joe20201830/expense-tracker` (private), branch `main`
- Run locally: `PORT=3003 node server.js`

The Add tab has a read-only category guide and an Apple Pay draft review area, shown above the 14-day spending card only when drafts exist. Pending transactions use the `ApplePayDrafts` tab of the existing Google Sheet, created on the first draft. They enter `Sheet1` and spending totals only after finalization. See `APPLE_PAY_SETUP.md` for iPhone Shortcut setup and troubleshooting.

The access token is now kept in browser `localStorage` across app launches, with migration from `sessionStorage`. A user whose old session was already cleared may need to enter it once after the update. Storage is separate for each browser/app origin; an invalid token still triggers a new prompt after HTTP 401.

Live checks passed for `/`, `/manifest.json`, and `/sw.js` (HTTP 200). Unauthenticated requests to `/api/expenses/all` and `/api/apple-pay-drafts` return HTTP 401, confirming the Production `API_TOKEN` is active. Draft create/list/update/finalize passed a mock-sheet test; no live draft or expense was created during verification.

## Unresolved

The user configured a 國泰 CUBE card Transaction shortcut on the iPhone. Screenshots showed `Current Date` → `Format Date` → `Get Contents of URL`, a POST JSON body with `date`, `amount`, `currency`, `merchant`, and `method`, and an Authorization header. The user made an Apple Pay payment on 2026-11-13 but had not confirmed whether the automation ran or whether a draft appeared. The live authenticated draft flow has not been verified because the token is user-held.

## Watchouts

- Read the Deployment section of `CLAUDE.md` before touching `vercel.json` or the function routes. Two separate mistakes there each broke production once.
- `Design Reference*.webp` is gitignored; the theme reference images are deliberately kept out of the repo.
- Recurring items live in browser localStorage, not Google Sheets. Existing items have no payment method until edited.
- Apple Pay drafts require `API_TOKEN`; do not put it in Git or chat.

## Next Step

Ask the user whether the Add tab shows an **Apple Pay drafts** card. If not, inspect the iPhone automation's enabled/automatic-run settings and any shortcut error; do not ask for the token or a screenshot showing it. Check that a future Wallet tap creates one pending draft with the expected amount, date, merchant, and payment method; then finalize it and verify it appears once in History. Also confirm whether reopening the installed app a second time still prompts for a token.
