/**
 * Task 6A: Build a clean static site directory for deployment.
 *
 * Copies dashboard.html + data/latest.json into dist/.
 * Excludes src, node_modules, .env, raw, generated, and reference projects.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const DIST = path.resolve("dist");
const DIST_DATA = path.join(DIST, "data");

const DASHBOARD_SRC = path.join(ROOT, "dashboard.html");
const LATEST_SRC = path.join(ROOT, "data", "latest.json");

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface Rec {
  title?: string;
  url?: string;
  source?: string;
  score?: number;
}

interface Latest {
  topRecommendations?: Rec[];
  llmReport?: { summary?: string | null };
  stats?: { recommendationCount?: number };
}

function validateLatest(filepath: string): Latest {
  if (!fs.existsSync(filepath)) {
    throw new Error(`${filepath} not found. Run 'npm run radar:generate:latest' first.`);
  }

  let data: Latest;
  try {
    data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (err) {
    throw new Error(`Failed to parse ${filepath}: ${String(err)}`);
  }

  if (!Array.isArray(data.topRecommendations)) {
    throw new Error("topRecommendations is not an array");
  }
  if (data.topRecommendations.length === 0) {
    throw new Error("topRecommendations is empty");
  }

  for (let i = 0; i < data.topRecommendations.length; i++) {
    const r = data.topRecommendations[i]!;
    if (!r.title) throw new Error(`topRecommendations[${i}] missing title`);
    if (!r.url) throw new Error(`topRecommendations[${i}] missing url`);
    if (!r.source) throw new Error(`topRecommendations[${i}] missing source`);
    if (typeof r.score !== "number") throw new Error(`topRecommendations[${i}] missing score`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[site:build] Task 6A — building static site...\n");

  // 1. Validate
  const latest = validateLatest(LATEST_SRC);
  const topCount = latest.topRecommendations!.length;
  const hasLlm = !!latest.llmReport?.summary;
  console.log(`[site:build] data/latest.json: ${topCount} recommendations, LLM report: ${hasLlm}`);

  if (!fs.existsSync(DASHBOARD_SRC)) {
    throw new Error(`${DASHBOARD_SRC} not found.`);
  }
  console.log(`[site:build] dashboard.html: found`);

  // 2. Clean + create dist
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
    console.log(`[site:build] Cleaned ${DIST}`);
  }
  fs.mkdirSync(DIST_DATA, { recursive: true });

  // 3. Copy files
  fs.copyFileSync(DASHBOARD_SRC, path.join(DIST, "dashboard.html"));
  console.log(`[site:build] Copied dashboard.html`);

  fs.copyFileSync(LATEST_SRC, path.join(DIST_DATA, "latest.json"));
  console.log(`[site:build] Copied data/latest.json`);

  // 4. Summary
  const files = walkDist(DIST);
  console.log(`\n[site:build] Done.`);
  console.log(`  Output: ${DIST}/`);
  console.log(`  Files: ${files.length}`);
  files.forEach((f) => console.log(`    - ${path.relative(DIST, f)}`));
  console.log(`  Recommendations: ${topCount}`);
  console.log(`  LLM report: ${hasLlm ? "yes" : "no"}`);
  console.log(`  Excluded: src, node_modules, .env, data/raw, data/generated, _reference`);
}

function walkDist(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      result.push(...walkDist(full));
    } else {
      result.push(full);
    }
  }
  return result.sort();
}

try {
  main();
} catch (err) {
  console.error("[site:build] ERROR:", err);
  process.exit(1);
}
