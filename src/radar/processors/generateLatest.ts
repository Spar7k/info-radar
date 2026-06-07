/**
 * Task 3B entry point — writes data/latest.json (no _meta).
 *
 * Backs up the existing data/latest.json before overwriting, validates the
 * output structure, then writes the new file.
 */

import fs from "node:fs";
import path from "node:path";
import { buildLatestOutput, loadRawData, validateOutput } from "./buildOutput.ts";

const LATEST_PATH = path.resolve("data", "latest.json");
const BACKUP_DIR = path.resolve("data", "generated");
const BACKUP_PATH = path.resolve(BACKUP_DIR, "latest_backup_before_task3b.json");

async function main(): Promise<void> {
  console.log("[radar:latest] Task 3B — generating formal data/latest.json...");

  // 1. Backup existing latest.json if it exists
  if (fs.existsSync(LATEST_PATH)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(LATEST_PATH, BACKUP_PATH);
    console.log(`[radar:latest] Backup saved to ${BACKUP_PATH}`);
  } else {
    console.log(`[radar:latest] No existing data/latest.json to backup.`);
  }

  // 2. Load raw data
  const raw = loadRawData();
  console.log(`[radar:latest] Loaded ${raw.items.length} raw items.`);

  // 3. Build output
  const { output, meta } = buildLatestOutput(raw, new Date());

  console.log(
    `[radar:latest] Dedupe: ${meta.dedupeStats.before} → ${meta.dedupeStats.after} ` +
      `(removed ${meta.dedupeStats.removed})`,
  );
  console.log(`[radar:latest] Scored ${output.stats.totalScored} items.`);

  // 4. Validate before writing
  validateOutput(output);
  console.log(`[radar:latest] Validation passed.`);

  // 5. Write (no _meta — clean output for frontend consumption)
  fs.writeFileSync(LATEST_PATH, JSON.stringify(output, null, 2), "utf-8");

  // 6. Summary
  console.log(`\n[radar:latest] Done.`);
  console.log(`  Output: ${LATEST_PATH}`);
  console.log(`  Sources: ${output.sources.join(", ")}`);
  console.log(`  Top 10:`);
  output.topRecommendations.forEach((item, i) => {
    console.log(`    ${i + 1}. [${item.source}] ${item.title.slice(0, 60)} (${item.score})`);
  });
  console.log(`  Keywords: ${output.keywords.join(", ")}`);
  console.log(`  Source status: ${JSON.stringify(meta.sourceStatus)}`);
}

main().catch((err) => {
  console.error("[radar:latest] Fatal error:", err);
  process.exit(1);
});
