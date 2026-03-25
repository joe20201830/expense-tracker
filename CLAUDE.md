# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

```bash
node server.js
```

No build step. After adding dependencies run `npm install`.

## Architecture

Single-file Node.js HTTP server (`server.js`) + single-page app (`index.html`). No framework, no bundler.

**`server.js`** — raw `http.createServer`. Handles:
- `GET /` — serves `index.html`
- `GET /expenses/all` — fetches all rows from Google Sheet, returns newest-first JSON
- `POST /expense` — validates body, appends one row to Sheet
- `PUT /expense/:id` — updates a row by UUID (full sheet scan to find the row)
- `DELETE /expense/:id` — deletes a row by UUID (full sheet scan to find the row)
- `GET /manifest.json`, `/sw.js`, `/icon.png`, `/icon.svg` — static PWA assets

**`index.html`** — fully self-contained SPA. All CSS and JS inline. Three tabs managed by `switchTab()`:
- **Add** (default) — expense form + hero summary card
- **History** — most recent 10 expenses (sorted by spending date, not logged-at), category/method filters, "Recurring" button showing monthly subscriptions
- **Analytics** — last-7-days bar chart, 6-week trend line chart, category breakdown (all via Chart.js CDN)

**`google-apps-script.js`** — standalone script pasted into Google Sheets Apps Script editor. Calls the Claude API directly via `UrlFetchApp` for in-sheet analysis. Not part of the Node app.

## Google Sheets integration

All Sheet access goes through `googleapis` with a service account. Auth picks credentials in this order:
1. `GOOGLE_SERVICE_ACCOUNT_KEY` env var (JSON string) — used in production (Railway)
2. `./credentials.json` file — used locally

Sheet columns: `Date | Amount | Currency | Category | Description | Method | Logged At | ID`

Sheet name is hardcoded as `SHEET_NAME = "Sheet1"`. To add a second tab, create a new read/write function and change the range prefix (e.g. `Budget!A:C`).

## Environment variables

| Variable | Notes |
|----------|-------|
| `SPREADSHEET_ID` | Google Sheet ID from URL |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full credentials JSON as a string (production) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Path to credentials file (local, defaults to `./credentials.json`) |
| `DEFAULT_CURRENCY` | Defaults to `TWD` |
| `PORT` | Defaults to `3003` |

## Frontend data flow

All expense data is fetched once via `fetchAll()` and cached in `allExpenses`. Cache is invalidated on every new submission. History and Analytics tabs use this cache — they only fetch on first open (`historyLoaded` / `analyticsLoaded` flags).

## Deployment

Pushed to GitHub (`joe20201830/expense-tracker`, private). Railway auto-deploys on every push to `main`. Production env vars are set in Railway's Variables tab.

## Valid field values

Hardcoded in `server.js` — update both server and `index.html` dropdowns together if adding new options:
- **Currencies:** `TWD`, `USD`
- **Categories:** `Food`, `Transport`, `Shopping`, `Health`, `Entertainment`, `Bills`, `Travel`, `Other`
- **Methods:** `Cash`, `Credit Card (國泰)`, `EtherFi`
