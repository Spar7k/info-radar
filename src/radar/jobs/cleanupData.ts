/**
 * Data retention cleanup — removes old raw/generated files.
 *
 * Default: dry-run only. Set INFO_RADAR_CLEANUP_APPLY=true to actually delete.
 *
 * Retention defaults:
 *   raw files:       30 days (INFO_RADAR_RAW_RETENTION_DAYS)
 *   generated files: 14 days (INFO_RADAR_GENERATED_RETENTION_DAYS)
 *
 * Protected (never deleted):
 *   data/latest.json, data/status.json, data/raw/latest_raw.json,
 *   data/server/email_settings.json
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = path.resolve(".");
const APPLY = process.env["INFO_RADAR_CLEANUP_APPLY"] === "true";
const RAW_RETENTION = parseInt(process.env["INFO_RADAR_RAW_RETENTION_DAYS"] || "30", 10) || 30;
const GEN_RETENTION = parseInt(process.env["INFO_RADAR_GENERATED_RETENTION_DAYS"] || "14", 10) || 14;

// Protected absolute paths (never deleted)
const PROTECTED = new Set([
  path.resolve("data", "latest.json"),
  path.resolve("data", "status.json"),
  path.resolve("data", "raw", "latest_raw.json"),
  path.resolve("data", "server", "email_settings.json"),
]);

// Only clean these directories with these extensions
const CLEAN_RULES: Array<{ dir: string; ext: string; retentionDays: number }> = [
  { dir: "data/raw", ext: ".json", retentionDays: RAW_RETENTION },
  { dir: "data/generated", ext: ".json", retentionDays: GEN_RETENTION },
  { dir: "data/generated", ext: ".html", retentionDays: GEN_RETENTION },
  { dir: "data/generated", ext: ".txt", retentionDays: GEN_RETENTION },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Stats {
  scanned: number;
  wouldDelete: number;
  deleted: number;
  protected_: number;
  errors: string[];
}

function fileAgeDays(filepath: string): number {
  const stat = fs.statSync(filepath);
  return (Date.now() - stat.mtimeMs) / 86_400_000;
}

function isProtected(absPath: string): boolean {
  return PROTECTED.has(absPath);
}

function cleanDir(dirRel: string, ext: string, retentionDays: number, stats: Stats): void {
  const dirAbs = path.resolve(ROOT, dirRel);
  if (!fs.existsSync(dirAbs)) {
    console.log(`  [skip] ${dirRel}/ does not exist`);
    return;
  }

  const cutoff = Date.now() - retentionDays * 86_400_000;
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(ext)) continue;

    const filepath = path.resolve(dirAbs, entry.name);
    stats.scanned++;

    if (isProtected(filepath)) {
      console.log(`  [protected] ${path.relative(ROOT, filepath)}`);
      stats.protected_++;
      continue;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filepath);
    } catch {
      continue; // file disappeared
    }

    if (stat.mtimeMs >= cutoff) continue; // still within retention

    stats.wouldDelete++;
    const rel = path.relative(ROOT, filepath);

    if (APPLY) {
      try {
        fs.unlinkSync(filepath);
        stats.deleted++;
        console.log(`  [deleted] ${rel} (age: ${fileAgeDays(filepath).toFixed(0)}d)`);
      } catch (err: unknown) {
        stats.errors.push(`${rel}: ${String(err)}`);
        console.error(`  [error] ${rel}: ${String(err)}`);
      }
    } else {
      console.log(`  [would-delete] ${rel} (age: ${fileAgeDays(filepath).toFixed(0)}d)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[cleanup] Data retention cleanup");
  console.log(`  Mode:      ${APPLY ? "APPLY (real delete)" : "DRY-RUN (preview only)"}`);
  console.log(`  Raw retention:       ${RAW_RETENTION} days`);
  console.log(`  Generated retention: ${GEN_RETENTION} days`);
  console.log(`  Protected files:     ${PROTECTED.size}`);
  console.log("");

  const stats: Stats = { scanned: 0, wouldDelete: 0, deleted: 0, protected_: 0, errors: [] };

  for (const rule of CLEAN_RULES) {
    console.log(`── ${rule.dir}/*${rule.ext} (${rule.retentionDays}d retention) ──`);
    cleanDir(rule.dir, rule.ext, rule.retentionDays, stats);
  }

  console.log(`\n[cleanup] Summary:`);
  console.log(`  Scanned:    ${stats.scanned}`);
  console.log(`  Protected:  ${stats.protected_}`);
  console.log(`  Would delete: ${stats.wouldDelete}`);
  if (APPLY) {
    console.log(`  Deleted:    ${stats.deleted}`);
  }
  if (stats.errors.length > 0) {
    console.log(`  Errors:     ${stats.errors.length}`);
    stats.errors.forEach((e) => console.error(`    - ${e}`));
  }

  if (!APPLY) {
    console.log(`\n[cleanup] DRY-RUN complete. Set INFO_RADAR_CLEANUP_APPLY=true to actually delete.`);
  } else {
    console.log(`\n[cleanup] Cleanup complete.`);
  }
}

try {
  main();
} catch (err) {
  console.error("[cleanup] Fatal:", err);
  process.exit(1);
}
