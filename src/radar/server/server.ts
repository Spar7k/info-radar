/**
 * Minimal Express API server for agent-radar.
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/email/settings
 *   POST /api/email/settings  { to, dailyEnabled }
 *   POST /api/email/send      { to }
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { loadSettings, saveSettings } from "./emailSettings.ts";
import { sendRadarEmail } from "../email/sendRadarEmail.ts";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env["INFO_RADAR_SERVER_PORT"] || "3000", 10);
const DIST = path.resolve("dist");
const hasDist = fs.existsSync(path.join(DIST, "dashboard.html"));

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "agent-radar-api" });
});

// ---------------------------------------------------------------------------
// GET settings
// ---------------------------------------------------------------------------

app.get("/api/email/settings", (_req, res) => {
  res.json({ ok: true, settings: loadSettings() });
});

// ---------------------------------------------------------------------------
// POST settings
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/email/settings", (req, res) => {
  const { to, dailyEnabled } = req.body ?? {};

  if (dailyEnabled === true && (!to || typeof to !== "string" || !to.trim())) {
    res.status(400).json({ ok: false, error: "开启每日推送前请先输入收件邮箱" });
    return;
  }

  if (to !== undefined && to !== "" && (typeof to !== "string" || !EMAIL_RE.test(to.trim()))) {
    res.status(400).json({ ok: false, error: "邮箱格式不正确" });
    return;
  }

  const savedTo = typeof to === "string" ? to.trim() : "";
  const enabled = dailyEnabled === true;

  const settings = saveSettings(savedTo, enabled);
  res.json({ ok: true, settings });
});

// ---------------------------------------------------------------------------
// POST send
// ---------------------------------------------------------------------------

app.post("/api/email/send", async (req, res) => {
  const { to } = req.body ?? {};

  if (!to || typeof to !== "string" || !EMAIL_RE.test(to.trim())) {
    res.status(400).json({ ok: false, error: "请输入有效的收件邮箱" });
    return;
  }

  // Verify send is enabled
  if (process.env["INFO_RADAR_EMAIL_SEND_ENABLED"] !== "true") {
    res.status(403).json({
      ok: false,
      error: "邮件发送未启用。请在服务器设置 INFO_RADAR_EMAIL_SEND_ENABLED=true",
    });
    return;
  }

  try {
    const result = await sendRadarEmail({ toOverride: to.trim() });
    res.json({
      ok: true,
      messageId: result.messageId,
      acceptedCount: result.accepted.length,
      rejectedCount: result.rejected.length,
    });
  } catch (err: unknown) {
    console.error("[server] Send failed:", String(err).slice(0, 200));
    res.status(500).json({
      ok: false,
      error: `发送失败: ${String(err).slice(0, 200)}`,
    });
  }
});

// ---------------------------------------------------------------------------
// Static files (after API routes — must come last)
// ---------------------------------------------------------------------------

function serveFile(res: express.Response, filepath: string, contentType: string): void {
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    res.type(contentType).send(content);
  } catch {
    res.status(404).send("File not found: " + path.basename(filepath));
  }
}

if (hasDist) {
  app.get("/dashboard.html", (_req, res) => serveFile(res, path.join(DIST, "dashboard.html"), "text/html"));
  app.get("/data/latest.json", (_req, res) => serveFile(res, path.join(DIST, "data", "latest.json"), "application/json"));
  app.get("/data/status.json", (_req, res) => {
    const sp = path.join(DIST, "data", "status.json");
    if (fs.existsSync(sp)) return serveFile(res, sp, "application/json");
    res.status(404).json({ error: "status.json not found" });
  });
  app.get("/", (_req, res) => res.redirect("/dashboard.html"));
} else {
  app.get("/", (_req, res) => {
    res.status(503).send("dist/ not found. Run: npm run site:build");
  });
  app.get("/dashboard.html", (_req, res) => {
    res.status(503).send("dist/dashboard.html not found. Run: npm run site:build");
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`[server] agent-radar API + static server running on http://localhost:${PORT}`);
  console.log(`[server] API:       http://localhost:${PORT}/api/health`);
  if (hasDist) {
    console.log(`[server] Dashboard: http://localhost:${PORT}/dashboard.html`);
  } else {
    console.log(`[server] Dashboard: dist/ not found — run 'npm run site:build' first`);
  }
});
