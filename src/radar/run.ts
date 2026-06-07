/**
 * Entry point — runs all fetchers and writes raw output to data/raw/.
 *
 * Usage:  npx tsx src/radar/run.ts
 *         pnpm radar:fetch
 *         npm run radar:fetch
 *
 * Output:
 *   data/raw/YYYY-MM-DD.json     — daily snapshot
 *   data/raw/latest_raw.json     — latest (overwritten each run)
 *
 * This script does NOT:
 *   - deduplicate across sources (Task 3)
 *   - score items (Task 3)
 *   - generate data/latest.json (Task 3)
 *   - call any LLM (Task 4)
 */

import fs from "node:fs";
import path from "node:path";
import type { RawOutput } from "./types.ts";
import { runFetchers } from "./fetchers/index.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filepath: string, data: unknown): void {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  Wrote ${filepath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const now = new Date();
  const dateStr = toDateStr(now);
  const iso = now.toISOString();

  console.log(`[radar] Run started at ${iso}`);

  // 1. Run all fetchers
  const results = await runFetchers();

  // 2. Flatten items from all results (preserving raw order, no dedupe)
  const allItems = results.flatMap((r) => r.items);
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  // 3. Collect unique source ids that actually returned data
  const sources = [...new Set(results.filter((r) => r.ok).map((r) => r.source))];

  // 4. Build output envelope
  const output: RawOutput = {
    date: dateStr,
    generatedAt: iso,
    sources,
    stats: {
      totalFetched: allItems.length,
      sourceCount: results.length,
      successSourceCount: okCount,
      failedSourceCount: failCount,
    },
    results,
    items: allItems,
  };

  // 5. Write to data/raw/
  const rawDir = path.resolve("data", "raw");
  ensureDir(rawDir);

  writeJson(path.join(rawDir, `${dateStr}.json`), output);
  writeJson(path.join(rawDir, "latest_raw.json"), output);

  // 6. Summary
  console.log(`\n[radar] Done.`);
  console.log(`  Sources: ${okCount} OK / ${failCount} failed`);
  console.log(`  Total items: ${allItems.length}`);
  console.log(`  Files: data/raw/${dateStr}.json, data/raw/latest_raw.json`);
}

main().catch((err) => {
  console.error("[radar] Fatal error:", err);
  process.exit(1);
});
