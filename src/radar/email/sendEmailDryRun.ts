/**
 * Task 5B: SMTP dry-run — validates config and prints would-send summary.
 *
 * Does NOT connect to SMTP.  Does NOT send any email.  Does NOT call any LLM.
 */

import fs from "node:fs";
import path from "node:path";
import { loadLatest, renderEmailHtml, renderEmailText, sourceDist } from "./templates.ts";
import { loadEmailConfig } from "./config.ts";

const OUT_DIR = path.resolve("data", "generated");
const SUMMARY_PATH = path.join(OUT_DIR, "email_dry_run_summary.json");

function main(): void {
  console.log("[radar:email:dry-run] Task 5B — SMTP dry-run...");
  console.log("[radar:email:dry-run] DRY RUN ONLY — no email will be sent.\n");

  // 1. Load data
  const latest = loadLatest();
  const top10 = latest.topRecommendations;

  // 2. Render email content
  const html = renderEmailHtml(latest);
  const text = renderEmailText(latest);

  // 3. Load config (safe — env only, no file I/O)
  const config = loadEmailConfig();

  // 4. Build subject
  const dateStr = latest.date || new Date().toISOString().slice(0, 10);
  const subject = `agent雷达｜今日信息日报｜${dateStr}`;

  // 5. Print would-send summary
  console.log("── Would-send summary ──");
  console.log(`  From:    ${config.email?.from ?? "(not configured)"}`);
  console.log(`  To:      ${config.email?.to?.join(", ") ?? "(not configured)"}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  HTML:    ${html.length} bytes`);
  console.log(`  Text:    ${text.length} bytes`);
  console.log(`  Top rec: ${top10.length}`);
  console.log(`  Sources: ${JSON.stringify(sourceDist(top10))}`);
  console.log("");

  console.log("── SMTP config ──");
  console.log(`  Host:     ${config.smtp?.host ?? "(missing)"}`);
  console.log(`  Port:     ${config.smtp?.port ?? "(missing)"}`);
  console.log(`  Secure:   ${config.smtp?.secure ?? false}`);
  console.log(`  User:     ${config.smtp?.user ? "***configured***" : "(missing)"}`);
  console.log(`  Pass:     ${config.smtp?.pass ? "***configured***" : "(missing)"}`);

  if (config.missingFields.length > 0) {
    console.log(`\n  Missing config: ${config.missingFields.join(", ")}`);
  }

  // 6. Write summary JSON (no secrets)
  const summary = {
    dryRun: true,
    generatedAt: new Date().toISOString(),
    subject,
    from: config.email?.from ?? null,
    to: config.email?.to ?? [],
    htmlLength: html.length,
    textLength: text.length,
    topRecommendationsCount: top10.length,
    sourceDistribution: sourceDist(top10),
    smtp: {
      hostConfigured: !!config.smtp?.host,
      portConfigured: !!config.smtp?.port,
      userConfigured: !!config.smtp?.user,
      passConfigured: !!config.smtp?.pass,
    },
    missingFields: config.missingFields,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summary, null, 2), "utf-8");

  console.log(`\n[radar:email:dry-run] Summary written to ${SUMMARY_PATH}`);
  console.log("[radar:email:dry-run] DRY RUN COMPLETE — no email was sent.");
}

try {
  main();
} catch (err) {
  console.error("[radar:email:dry-run] Fatal:", err);
  process.exit(1);
}
