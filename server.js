require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const PORT = process.env.PORT || 3003;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "TWD";
const SHEET_NAME = "Sheet1";

const VALID_CURRENCIES = ["TWD", "USD"];
const VALID_CATEGORIES = ["Food", "Transport", "Shopping", "Health", "Entertainment", "Bills", "Travel", "Other"];
const VALID_METHODS = ["Cash", "Credit Card (國泰)", "EtherFi"];

function getAuthClient() {
  // Production: credentials passed as JSON string in env var
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return auth;
  }
  // Local: credentials read from file
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./credentials.json";
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, keyPath),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function ensureHeader(sheets) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:G1`,
  });
  const row = result.data.values?.[0];
  if (!row || row[0] !== "Date") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Date", "Amount", "Currency", "Category", "Description", "Method", "Logged At"]],
      },
    });
  }
}

async function appendExpense(expense) {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  await ensureHeader(sheets);
  const row = [
    expense.date,
    expense.amount,
    expense.currency,
    expense.category,
    expense.description || "",
    expense.method,
    new Date().toISOString(),
  ];
  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });
  return result.data.updates?.updatedRange;
}

async function fetchExpenses() {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:G`,
  });
  const rows = result.data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).reverse().map(([date, amount, currency, category, description, method, loggedAt]) => ({
    date, amount, currency, category, description, method, loggedAt,
  }));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    const file = fs.readFileSync(path.join(__dirname, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(file);
  }

  // Serve static PWA files
  if (req.method === "GET" && (req.url === "/manifest.json" || req.url === "/sw.js" || req.url === "/icon.svg" || req.url === "/icon.png")) {
    const filePath = path.join(__dirname, req.url.slice(1));
    if (fs.existsSync(filePath)) {
      const ext = req.url.endsWith(".json") ? "application/json" : req.url.endsWith(".svg") ? "image/svg+xml" : req.url.endsWith(".png") ? "image/png" : "application/javascript";
      res.writeHead(200, { "Content-Type": ext });
      return res.end(fs.readFileSync(filePath));
    }
  }

  if (req.method === "GET" && req.url === "/expenses/all") {
    try {
      const expenses = await fetchExpenses();
      return json(res, 200, { ok: true, expenses });
    } catch (e) {
      console.error("Fetch error:", e.message);
      return json(res, 500, { ok: false, error: e.message });
    }
  }

  if (req.method === "POST" && req.url === "/expense") {
    let body;
    try {
      body = await parseBody(req);
    } catch (e) {
      return json(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const { date, amount, currency, category, description, method } = body;

    if (!date || isNaN(Date.parse(date)))
      return json(res, 400, { ok: false, error: "Valid date is required" });
    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0)
      return json(res, 400, { ok: false, error: "Amount must be a positive number" });
    if (!VALID_CATEGORIES.includes(category))
      return json(res, 400, { ok: false, error: "Invalid category" });
    if (!VALID_METHODS.includes(method))
      return json(res, 400, { ok: false, error: "Invalid payment method" });
    if (description && description.length > 200)
      return json(res, 400, { ok: false, error: "Description max 200 characters" });

    const expense = {
      date,
      amount: Number(amount),
      currency: VALID_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY,
      category,
      description: description || "",
      method,
    };

    try {
      const updatedRange = await appendExpense(expense);
      console.log(`Logged: ${expense.date} | ${expense.currency} ${expense.amount} | ${expense.category} | ${expense.method}`);
      return json(res, 200, { ok: true, updatedRange });
    } catch (e) {
      console.error("Sheets error:", e.message);
      return json(res, 500, { ok: false, error: "Failed to write to Google Sheet" });
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Expense tracker running at http://localhost:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});
