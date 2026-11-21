# Apple Pay draft capture

The iPhone Shortcut sends a payment to `POST /api/apple-pay-drafts`. The tracker saves it on the `ApplePayDrafts` tab of the existing Google Sheet. It does **not** add the payment to spending totals until you review and save it in Expense Tracker.

## Before setting up the Shortcut

1. Set a strong `API_TOKEN` in the Vercel project's Production environment and redeploy. This protects the existing expense API and the new draft API. Keep the token out of Git and do not share the Shortcut.
2. Open Expense Tracker and enter the same token when prompted. The app remembers it on that device after a successful entry. The Apple Pay drafts area is hidden until at least one draft exists.

## iPhone Shortcut

Create a personal automation in Shortcuts using **Transaction → When I tap**, and select the Wallet card. Use a separate automation for each card that should map to a different Expense Tracker payment method. Enable automatic running and **Allow Running When Locked** if those options appear.

In the English Shortcuts editor, put the actions in this order: **Current Date** → **Format Date** → **Get Contents of URL**. Set **Format Date** to the custom format `yyyy-MM-dd`. In the JSON body, choose the blue **Formatted Date** variable for `date`. If it is red, remove and reselect it after moving **Format Date** above **Get Contents of URL**.

Add a **Get Contents of URL** action with:

- URL: `https://expense-tracker-sepia-psi-86.vercel.app/api/apple-pay-drafts`
- Method: `POST`
- Request body: JSON
- Header: `Authorization: Bearer <your API_TOKEN>`

Enter `Authorization` as the header key, and `Bearer ` followed by the token as its value, with one space after `Bearer`. Do not share screenshots showing the token.

JSON fields:

| Field | Shortcut value | Example |
| --- | --- | --- |
| `date` | Current Date, formatted as `yyyy-MM-dd` | `2026-11-12` |
| `amount` | Transaction Shortcut Input → Amount, as a number | `159` |
| `currency` | Fixed `TWD` for a TWD transaction; use `USD` for USD | `TWD` |
| `merchant` | Transaction Shortcut Input → Merchant; leave blank if unavailable | `Cafe` |
| `method` | Fixed to the selected card's tracker method | `Credit Card (國泰)` |

Supported methods are `Cash`, `Credit Card (國泰)`, and `EtherFi`. Start with one TWD card and one real transaction to verify the amount and merchant fields supplied by Wallet. The Shortcut's response should contain `"ok": true` and an `id`; if it fails, the transaction was not queued.

To set the transaction variables, insert **Shortcut Input** for each field, tap the variable, set **Type** to **Transaction**, then set **Get** to **Amount** or **Merchant**. The shortcut editor's play button does not supply a real Wallet transaction, so verify with a card tap.

## Review in Expense Tracker

Open the Add tab and tap **Review** on a draft. Date, amount, currency, payment method, and merchant note are filled in. If the merchant exactly matches at least two past notes that all have the same category, that category is preselected. Otherwise choose a category yourself. Tap **Add Expense** to finalize, **Save Draft for Later** to keep changes pending, or **Discard** to remove the draft.

Wallet transaction details can differ from the final charge. Review the amount before saving, especially for tips, holds, or foreign-currency payments.

## Troubleshooting

The **Apple Pay drafts** card appears near the top of **Add**, above **Spending in the Last 14 Days**, only when a draft was saved. A missing card means no draft was stored; it does not by itself show whether the automation failed to trigger or the HTTP request failed. Check the matching card's automation in Shortcuts and any error notification on the iPhone. Shortcuts does not provide a complete per-run automation history in its Automation list. If a draft appears, review it before finalizing; it will not appear in History or spending totals while pending.
