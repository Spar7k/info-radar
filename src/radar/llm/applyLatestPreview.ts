/**
 * Task 4B: Apply verified LLM preview to data/latest.json.
 *
 * Reads data/generated/latest_llm_preview.json, validates everything,
 * backs up the old data/latest.json, then overwrites it with LLM-enriched
 * data (stripping _meta for clean frontend consumption).
 *
 * Does NOT call any LLM.
 * Does NOT modify dashboard.html.
 */

import fs from "node:fs";
import path from "node:path";

const PREVIEW_PATH = path.resolve("data", "generated", "latest_llm_preview.json");
const LATEST_PATH = path.resolve("data", "latest.json");
const BACKUP_DIR = path.resolve("data", "generated");
const BACKUP_PATH = path.resolve(BACKUP_DIR, "latest_backup_before_task4b.json");

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED_REC_FIELDS = [
  "id", "title", "url", "source", "score", "publishedAt",
  "scoreBreakdown", "tags", "summary",
  "llmSummary", "llmRecommendationReason", "llmRiskNote",
] as const;

const REQUIRED_BREAKDOWN = ["relevance", "practicality", "popularity", "freshness", "sourceQuality", "penalty"];

function fail(msg: string): never {
  console.error(`[radar:llm:apply] VALIDATION FAILED: ${msg}`);
  console.error("[radar:llm:apply] data/latest.json was NOT modified.");
  process.exit(1);
}

function validate(preview: Record<string, unknown>): void {
  // Top-level checks
  if (!Array.isArray(preview.topRecommendations)) fail("topRecommendations is not an array");
  if (preview.topRecommendations.length === 0) fail("topRecommendations is empty");
  if (preview.topRecommendations.length > 10) fail("topRecommendations exceeds 10");

  if (!Array.isArray(preview.candidates)) fail("candidates is not an array");
  if (!preview.llmReport || typeof preview.llmReport !== "object") fail("llmReport is missing");

  // LLM status gate
  const meta = preview._meta as { llm?: { status?: string } } | undefined;
  if (!meta?.llm || meta.llm.status !== "ok") {
    fail(`_meta.llm.status is "${meta?.llm?.status ?? "missing"}" — must be "ok" to apply`);
  }

  // Per-item checks
  for (let i = 0; i < preview.topRecommendations.length; i++) {
    const rec = preview.topRecommendations[i] as Record<string, unknown>;
    for (const field of REQUIRED_REC_FIELDS) {
      if (!(field in rec)) fail(`topRecommendations[${i}] missing "${field}"`);
    }
    if (typeof rec.llmSummary !== "string" || !rec.llmSummary.trim()) {
      fail(`topRecommendations[${i}].llmSummary is empty`);
    }
    if (typeof rec.llmRecommendationReason !== "string" || !rec.llmRecommendationReason.trim()) {
      fail(`topRecommendations[${i}].llmRecommendationReason is empty`);
    }
    if (typeof rec.llmRiskNote !== "string" || !rec.llmRiskNote.trim()) {
      fail(`topRecommendations[${i}].llmRiskNote is empty`);
    }
    const bd = rec.scoreBreakdown as Record<string, unknown> | undefined;
    if (!bd) fail(`topRecommendations[${i}].scoreBreakdown missing`);
    for (const f of REQUIRED_BREAKDOWN) {
      if (!(f in bd)) fail(`topRecommendations[${i}].scoreBreakdown missing "${f}"`);
    }
  }

  // Report checks (warnings, not failures)
  const report = preview.llmReport as Record<string, unknown>;
  if (!report.summary || typeof report.summary !== "string" || !report.summary.trim()) {
    console.warn("[radar:llm:apply] WARNING: llmReport.summary is empty — proceeding anyway.");
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[radar:llm:apply] Task 4B — applying LLM preview to data/latest.json...");

  // 1. Load preview
  if (!fs.existsSync(PREVIEW_PATH)) {
    console.error(`[radar:llm:apply] ERROR: ${PREVIEW_PATH} not found. Run 'npm run radar:llm:preview' first.`);
    process.exit(1);
  }

  let preview: Record<string, unknown>;
  try {
    preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, "utf-8")) as Record<string, unknown>;
  } catch (err) {
    console.error(`[radar:llm:apply] ERROR: failed to parse ${PREVIEW_PATH}: ${String(err)}`);
    process.exit(1);
  }

  console.log(`[radar:llm:apply] Loaded preview (${(preview.topRecommendations as unknown[]).length} recommendations).`);

  // 2. Validate
  validate(preview);
  console.log("[radar:llm:apply] Validation passed.");

  // 3. Backup old latest.json
  if (fs.existsSync(LATEST_PATH)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(LATEST_PATH, BACKUP_PATH);
    console.log(`[radar:llm:apply] Backup: ${BACKUP_PATH}`);
  } else {
    console.log("[radar:llm:apply] No existing data/latest.json to backup.");
  }

  // 4. Strip _meta and write
  const { _meta, ...clean } = preview;
  fs.writeFileSync(LATEST_PATH, JSON.stringify(clean, null, 2), "utf-8");

  // 5. Summary
  const top10 = clean.topRecommendations as Array<Record<string, unknown>>;
  const report = clean.llmReport as Record<string, unknown>;

  console.log(`\n[radar:llm:apply] Done.`);
  console.log(`  Output: ${LATEST_PATH}`);
  console.log(`  topRecommendations: ${top10.length}`);
  console.log(`  All have LLM fields: ${top10.every((r) => r.llmSummary && r.llmRecommendationReason && r.llmRiskNote)}`);
  console.log(`  llmReport.summary: ${report.summary ? "yes" : "no"}`);
  console.log(`  llmReport.markdown: ${report.markdown ? "yes" : "no"}`);
  console.log(`  _meta stripped: yes`);
}

main();
