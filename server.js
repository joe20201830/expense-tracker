require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3003;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "TWD";
const API_TOKEN = (process.env.API_TOKEN || "").trim();
const SHEET_NAME = "Sheet1";

const VALID_CURRENCIES = ["TWD", "USD"];
const VALID_CATEGORIES = ["Food", "Transport", "Shopping", "Health", "Entertainment", "Bills", "Travel", "Other"];
const VALID_METHODS = ["Cash", "Credit Card (國泰)", "EtherFi"];

function parseServiceAccountCredentials(rawValue) {
  try {
    return JSON.parse(rawValue);
  } catch (_) {
    try {
      const decoded = Buffer.from(rawValue, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_KEY");
    }
  }
}

function getAuthClient() {
  let credentials;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    credentials = parseServiceAccountCredentials(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } else {
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./credentials.json";
    try {
      credentials = JSON.parse(fs.readFileSync(path.resolve(__dirname, keyPath), "utf8"));
    } catch {
      throw new Error("Invalid Google service account file");
    }
  }
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
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

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return "";
  return authHeader.slice("Bearer ".length).trim();
}

function requireApiToken(req, res) {
  if (!API_TOKEN) return true;
  if (getBearerToken(req) === API_TOKEN) return true;
  json(res, 401, { ok: false, error: "Unauthorized" });
  return false;
}

function validateExpensePayload(payload) {
  const { date, amount, currency, category, description, method } = payload || {};
  if (!date || isNaN(Date.parse(date))) {
    return { error: "Valid date is required" };
  }
  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    return { error: "Amount must be a positive number" };
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return { error: "Invalid category" };
  }
  if (!VALID_METHODS.includes(method)) {
    return { error: "Invalid payment method" };
  }
  if (description != null && typeof description !== "string") {
    return { error: "Description must be text" };
  }

  const normalizedDescription = (description || "").trim();
  if (normalizedDescription.length > 200) {
    return { error: "Description max 200 characters" };
  }

  return {
    expense: {
      date,
      amount: Number(amount),
      currency: VALID_CURRENCIES.includes(currency) ? currency : DEFAULT_CURRENCY,
      category,
      description: normalizedDescription,
      method,
    },
  };
}

async function getSheetId(sheets) {
  const result = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title)",
  });
  const sheet = result.data.sheets?.find((entry) => entry.properties?.title === SHEET_NAME);
  if (!sheet || sheet.properties?.sheetId == null) {
    throw new Error(`Sheet "${SHEET_NAME}" not found`);
  }
  return sheet.properties.sheetId;
}

async function ensureHeader(sheets) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:H1`,
  });
  const row = result.data.values?.[0];
  if (!row || row[0] !== "Date") {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Date", "Amount", "Currency", "Category", "Description", "Method", "Logged At", "ID"]],
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
    expense.id || randomUUID(),
  ];
  const result = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:H`,
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
    range: `${SHEET_NAME}!A:H`,
  });
  const rows = result.data.values || [];
  if (rows.length <= 1) return [];
  return rows.slice(1).reverse().map(([date, amount, currency, category, description, method, loggedAt, id]) => ({
    date, amount, currency, category, description, method, loggedAt, id,
  }));
}

async function handler(req, res) {
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
    if (!requireApiToken(req, res)) return;
    try {
      const expenses = await fetchExpenses();
      return json(res, 200, { ok: true, expenses });
    } catch (e) {
      console.error("Fetch error:", e.message);
      return json(res, 500, { ok: false, error: "Failed to fetch expenses" });
    }
  }

  if (req.method === "POST" && req.url === "/expense") {
    if (!requireApiToken(req, res)) return;
    let body;
    try {
      body = await parseBody(req);
    } catch (e) {
      return json(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const { expense, error } = validateExpensePayload(body);
    if (error) return json(res, 400, { ok: false, error });

    try {
      const updatedRange = await appendExpense(expense);
      console.log(`Logged: ${expense.date} | ${expense.currency} ${expense.amount} | ${expense.category} | ${expense.method}`);
      return json(res, 200, { ok: true, updatedRange });
    } catch (e) {
      console.error("Sheets error:", e.message);
      return json(res, 500, { ok: false, error: "Failed to write to Google Sheet" });
    }
  }

  if (req.method === "DELETE" && req.url.startsWith("/expense/")) {
    if (!requireApiToken(req, res)) return;
    const id = req.url.split("/").pop();
    try {
      const auth = getAuthClient();
      const sheets = google.sheets({ version: "v4", auth });
      const sheetId = await getSheetId(sheets);
      const result = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:H`,
      });
      const rows = result.data.values || [];
      const rowIndex = rows.findIndex(row => row[7] === id);
      
      if (rowIndex === -1) return json(res, 404, { ok: false, error: "Expense not found" });
      
      const request = {
        requests: [{
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 }
          },
        }],
      };
      await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: request });
      
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error("Delete error:", e.message);
      return json(res, 500, { ok: false, error: "Failed to delete from Google Sheet" });
    }
  }

  if (req.method === "PUT" && req.url.startsWith("/expense/")) {
    if (!requireApiToken(req, res)) return;
    const id = req.url.split("/").pop();
    let body;
    try { body = await parseBody(req); } catch (e) { return json(res, 400, { ok: false, error: "Invalid JSON body" }); }

    const { expense, error } = validateExpensePayload(body);
    if (error) return json(res, 400, { ok: false, error });

    try {
      const auth = getAuthClient();
      const sheets = google.sheets({ version: "v4", auth });
      const result = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${SHEET_NAME}!A:H` });
      const rows = result.data.values || [];
      const rowIndex = rows.findIndex(row => row[7] === id);
      
      if (rowIndex === -1) return json(res, 404, { ok: false, error: "Expense not found" });
      
      const loggedAt = rows[rowIndex][6];
      const rowData = [expense.date, expense.amount, expense.currency, expense.category, expense.description, expense.method, loggedAt, id];
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A${rowIndex + 1}:H${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [rowData] }
      });
      return json(res, 200, { ok: true });
    } catch (e) {
      console.error("Update error:", e.message);
      return json(res, 500, { ok: false, error: "Failed to update Google Sheet" });
    }
  }

  res.writeHead(404);
  res.end("Not found");
}

module.exports = handler;

if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`Expense tracker running at http://localhost:${PORT}`);
    console.log("Press Ctrl+C to stop.");
  });
}
