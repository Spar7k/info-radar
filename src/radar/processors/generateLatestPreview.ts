/**
 * Task 3A entry point — writes data/generated/latest_preview.json (with _meta).
 */

import fs from "node:fs";
import path from "node:path";
import { buildLatestOutput, loadRawData, validateOutput, type PipelineMeta } from "./buildOutput.ts";

const OUT_PATH = path.resolve("data", "generated", "latest_preview.json");

async function main(): Promise<void> {
  console.log("[radar:preview] Task 3A — generating preview from raw data...");

  const raw = loadRawData();
  console.log(`[radar:preview] Loaded ${raw.items.length} raw items.`);

  const { output, meta } = buildLatestOutput(raw, new Date());

  console.log(
    `[radar:preview] Dedupe: ${meta.dedupeStats.before} → ${meta.dedupeStats.after} ` +
      `(removed ${meta.dedupeStats.removed})`,
  );
  console.log(`[radar:preview] Scored ${output.stats.totalScored} items.`);

  validateOutput(output);
  console.log(`[radar:preview] Validation passed.`);

  // Attach debug metadata for preview
  const preview = { ...output, _meta: { task: "Task 3A preview" as const, ...meta } };

  const outDir = path.dirname(OUT_PATH);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(preview, null, 2), "utf-8");

  console.log(`\n[radar:preview] Done.`);
  console.log(`  Output: ${OUT_PATH}`);
  output.topRecommendations.forEach((item, i) => {
    console.log(`    ${i + 1}. [${item.source}] ${item.title.slice(0, 60)} (${item.score})`);
  });
  console.log(`  Keywords: ${output.keywords.join(", ")}`);
  console.log(`\n  data/latest.json was NOT modified.`);
}

main().catch((err) => {
  console.error("[radar:preview] Fatal error:", err);
  process.exit(1);
});
