/**
 * Daily data refresh — called by cron/systemd timer at 07:30 Beijing time.
 *
 * Steps:
 *   1. fetch       → data/raw/
 *   2. generate    → data/latest.json (rule-based)
 *   3. llm:preview → data/generated/latest_llm_preview.json (optional)
 *   4. llm:apply   → enriches data/latest.json (optional)
 *   5. status      → data/status.json
 *   6. site:build  → dist/
 *
 * Does NOT send emails.
 */

import { execSync } from "node:child_process";

const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function hasEnv(key: string): boolean {
  return !!process.env[key]?.trim();
}

function run(label: string, args: string): void {
  const cmd = `${NPM} run ${args}`;
  console.log(`\n── [${label}] ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
  } catch {
    throw new Error(`Step failed: ${label}`);
  }
}

function runOptional(label: string, args: string): boolean {
  const cmd = `${NPM} run ${args}`;
  console.log(`\n── [${label}] ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
    return true;
  } catch {
    console.warn(`  [daily-refresh] ${label} failed — skipping (non-blocking).`);
    return false;
  }
}

function main(): void {
  console.log("[daily-refresh] Starting daily data refresh...");
  console.log("[daily-refresh] Time target: 07:30 Asia/Shanghai (Beijing time)");

  const start = Date.now();

  // Step 1: Fetch (blocking — must succeed for data freshness)
  run("fetch", "radar:fetch");

  // Step 2: Generate rule-based latest.json (blocking)
  run("generate", "radar:generate:latest");

  // Step 3-4: LLM enrichment (optional — no API key = skip gracefully)
  const hasLlmKey = hasEnv("INFO_RADAR_LLM_API_KEY");
  if (hasLlmKey) {
    const previewOk = runOptional("llm preview", "radar:llm:preview");
    if (previewOk) {
      runOptional("llm apply", "radar:llm:apply");
    } else {
      console.warn("[daily-refresh] LLM preview failed — keeping rule-based recommendations.");
    }
  } else {
    console.warn("[daily-refresh] LLM skipped — no INFO_RADAR_LLM_API_KEY.");
  }

  // Step 5: Status file
  run("status", "radar:status");

  // Step 6-7: Build + check
  run("site:build", "site:build");
  run("site:check", "site:check");

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[daily-refresh] Done in ${elapsed}s.`);
}

try {
  main();
} catch (err) {
  console.error("[daily-refresh] FAILED:", String(err).slice(0, 500));
  process.exit(1);
}
