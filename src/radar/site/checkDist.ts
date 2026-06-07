/**
 * Verifies the dist/ directory is clean and deployable.
 */

import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve("dist");

const REQUIRED = ["dashboard.html", path.join("data", "latest.json")];
const FORBIDDEN = ["src", "node_modules", ".env", "data/raw", "data/generated", "_reference"];

function main(): void {
  console.log("[site:check] Verifying dist/...\n");

  if (!fs.existsSync(DIST)) {
    console.error("[site:check] FAIL: dist/ does not exist. Run 'npm run site:build' first.");
    process.exit(1);
  }

  const failures: string[] = [];

  for (const f of REQUIRED) {
    const full = path.join(DIST, f);
    if (!fs.existsSync(full)) {
      failures.push(`Missing: ${f}`);
    } else {
      console.log(`  ✅ ${f}`);
    }
  }

  for (const f of FORBIDDEN) {
    const full = path.join(DIST, f);
    if (fs.existsSync(full)) {
      failures.push(`Should not exist: ${f}`);
    }
  }

  if (failures.length > 0) {
    console.log("");
    failures.forEach((f) => console.error(`  ❌ ${f}`));
    process.exit(1);
  }

  const latest = JSON.parse(fs.readFileSync(path.join(DIST, "data", "latest.json"), "utf-8"));
  console.log(`  📊 ${latest.topRecommendations?.length ?? 0} recommendations`);

  console.log("\n[site:check] All checks passed.");
}

try {
  main();
} catch (err) {
  console.error("[site:check] ERROR:", err);
  process.exit(1);
}
