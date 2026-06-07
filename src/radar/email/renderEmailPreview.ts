/**
 * Task 5A: Generate email preview (HTML + plain text) from data/latest.json.
 *
 * Does NOT send mail.  Does NOT call any LLM.  Does NOT connect to SMTP.
 */

import fs from "node:fs";
import path from "node:path";
import { loadLatest, renderEmailHtml, renderEmailText, sourceDist } from "./templates.ts";

const OUT_DIR = path.resolve("data", "generated");
const HTML_PATH = path.join(OUT_DIR, "email_preview.html");
const TXT_PATH = path.join(OUT_DIR, "email_preview.txt");

function main(): void {
  console.log("[radar:email] Task 5A — generating email preview...");

  const latest = loadLatest();
  const top10 = latest.topRecommendations;

  const dist = sourceDist(top10);
  console.log(`[radar:email] Loaded ${top10.length} recommendations. Source dist: ${JSON.stringify(dist)}`);

  const html = renderEmailHtml(latest);
  const text = renderEmailText(latest);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, html, "utf-8");
  fs.writeFileSync(TXT_PATH, text, "utf-8");

  console.log(`\n[radar:email] Done.`);
  console.log(`  HTML: ${HTML_PATH} (${html.length} bytes)`);
  console.log(`  TXT:  ${TXT_PATH} (${text.length} bytes)`);
  console.log(`  Top 10: ${top10.length} | Top 5: ${Math.min(5, top10.length)}`);
  console.log(`  No email was sent. No SMTP was called.`);
}

try {
  main();
} catch (err) {
  console.error("[radar:email] Fatal:", err);
  process.exit(1);
}
