// ============================================================
// Claude AI — Expense Tracker Google Apps Script
// ============================================================
// Setup:
//   1. In your sheet: Extensions → Apps Script → paste this file
//   2. Extensions → Apps Script → Project Settings → Script Properties
//      Add property: ANTHROPIC_API_KEY = sk-ant-...
//   3. Save & reload your sheet — a "Claude AI" menu will appear
// ============================================================

const SHEET_NAME = "Sheet1";
const MODEL = "claude-haiku-4-5-20251001"; // fast & cheap for analysis

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Claude AI")
    .addItem("Monthly Summary", "monthlySummary")
    .addItem("Spending Insights", "spendingInsights")
    .addItem("Ask Claude...", "askClaude")
    .addToUi();
}

// ── Helpers ──────────────────────────────────────────────────

function getApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY not set in Script Properties.");
  return key;
}

function getExpenseData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) throw new Error("No expense data found in the sheet.");
  const [headers, ...data] = rows;
  return data.map(row =>
    headers.reduce((obj, h, i) => { obj[h] = row[i]; return obj; }, {})
  );
}

function callClaude(prompt) {
  const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    headers: {
      "x-api-key": getApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    payload: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (result.error) throw new Error(result.error.message);
  return result.content[0].text;
}

function showResult(title, text) {
  const ui = SpreadsheetApp.getUi();
  const html = HtmlService.createHtmlOutput(
    `<style>
      body { font-family: -apple-system, sans-serif; font-size: 14px; padding: 16px; line-height: 1.6; }
      h3 { margin-top: 0; color: #1a1d23; }
      pre { white-space: pre-wrap; word-break: break-word; background: #f2f4f7; padding: 12px; border-radius: 8px; }
    </style>
    <h3>${title}</h3><pre>${text}</pre>`
  ).setWidth(480).setHeight(420);
  ui.showModalDialog(html, title);
}

function buildDataSummary(expenses) {
  return expenses.map(e =>
    `${e["Date"]} | ${e["Currency"]} ${e["Amount"]} | ${e["Category"]} | ${e["Method"]}${e["Description"] ? " | " + e["Description"] : ""}`
  ).join("\n");
}

// ── Menu Actions ─────────────────────────────────────────────

function monthlySummary() {
  try {
    const expenses = getExpenseData();
    const data = buildDataSummary(expenses);
    const prompt = `Here are my expense records:\n\n${data}\n\nPlease give me a concise monthly summary broken down by month. For each month show: total spent per currency, breakdown by category, and which payment method I used most. Use plain text, no markdown.`;
    const result = callClaude(prompt);
    showResult("Monthly Summary", result);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error: " + e.message);
  }
}

function spendingInsights() {
  try {
    const expenses = getExpenseData();
    const data = buildDataSummary(expenses);
    const prompt = `Here are my expense records:\n\n${data}\n\nAnalyze my spending and give me 4–5 practical insights. For example: my top spending categories, any unusual spikes, patterns by day or method, and one actionable tip to save money. Use plain text, no markdown.`;
    const result = callClaude(prompt);
    showResult("Spending Insights", result);
  } catch (e) {
    SpreadsheetApp.getUi().alert("Error: " + e.message);
  }
}

function askClaude() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    "Ask Claude about your expenses",
    "e.g. How much did I spend on food last month?",
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const question = response.getResponseText().trim();
  if (!question) return;

  try {
    const expenses = getExpenseData();
    const data = buildDataSummary(expenses);
    const prompt = `Here are my expense records:\n\n${data}\n\nQuestion: ${question}\n\nAnswer concisely in plain text, no markdown.`;
    const result = callClaude(prompt);
    showResult("Claude's Answer", result);
  } catch (e) {
    ui.alert("Error: " + e.message);
  }
}
