import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { checkServiceAccountSpreadsheetAccess, fetchWithServiceAccount, validateSheetsPath, validateSpreadsheetId } from "./server/googleServiceAccount";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.set('trust proxy', true);

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/spreadsheets/service-account/status", async (req, res) => {
    try {
      const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
      const status = await checkServiceAccountSpreadsheetAccess(spreadsheetId);
      res.status(status.accessible ? 200 : 403).json(status);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.all("/api/spreadsheets/service-account/proxy", async (req, res) => {
    try {
      const spreadsheetId = validateSpreadsheetId(req.query.spreadsheetId);
      const path = validateSheetsPath(req.query.path);
      const body = req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});

      const response = await fetchWithServiceAccount(spreadsheetId, path, {
        method: req.method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
      });

      const text = await response.text();
      res.status(response.status);
      const contentType = response.headers.get('content-type');
      if (contentType) res.setHeader('content-type', contentType);
      res.send(text);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static('dist'));
    
    // SPA fallback
    const path = await import('path');
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
