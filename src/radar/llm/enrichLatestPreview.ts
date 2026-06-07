/**
 * Task 4A: LLM enrichment preview.
 *
 * Reads data/latest.json, sends the Top 10 items to an OpenAI-compatible LLM,
 * and writes enriched output to data/generated/latest_llm_preview.json.
 *
 * When INFO_RADAR_LLM_API_KEY is not set, the script completes successfully
 * with llm.status = "skipped_no_api_key" and all LLM fields left null.
 *
 * Does NOT overwrite data/latest.json.
 * Does NOT modify dashboard.html.
 */

import fs from "node:fs";
import path from "node:path";
import type { LatestOutput, RecommendationItem } from "../processors/buildOutput.ts";
import { loadLlmConfig, LlmClient } from "./client.ts";
import { buildEnrichmentPrompt, type LlmPromptItem } from "./prompt.ts";
import type { LlmItemEnrichment, LlmMeta, LlmReportEnrichment, LlmResponse } from "./types.ts";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const LATEST_PATH = path.resolve("data", "latest.json");
const OUT_PATH = path.resolve("data", "generated", "latest_llm_preview.json");

// ---------------------------------------------------------------------------
// JSON sanitize — strip ```json fences
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  let result = text.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```(?:json)?\s*\n?/, "");
    result = result.replace(/\n?```\s*$/, "");
  }
  return result.trim();
}

// ---------------------------------------------------------------------------
// Validation & trimming
// ---------------------------------------------------------------------------

function trimField(val: unknown, maxChars: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxChars);
}

function validateAndMerge(
  items: RecommendationItem[],
  parsed: LlmResponse,
): RecommendationItem[] {
  const llmItems = parsed.items ?? [];
  const map = new Map<string, LlmItemEnrichment>();
  for (const li of llmItems) {
    if (li && typeof li.id === "string") {
      map.set(li.id, li);
    }
  }

  return items.map((item) => {
    const enrichment = map.get(item.id);
    if (!enrichment) return item;

    const llmSummary = trimField(enrichment.llmSummary, 120);
    const llmRecommendationReason = trimField(enrichment.llmRecommendationReason, 180);
    const llmRiskNote = trimField(enrichment.llmRiskNote, 180);

    // Only set fields if the LLM actually returned something meaningful
    return {
      ...item,
      llmSummary: llmSummary || null,
      llmRecommendationReason: llmRecommendationReason || null,
      llmRiskNote: llmRiskNote || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[radar:llm] Task 4A — LLM enrichment preview...");

  // 1. Load latest.json
  if (!fs.existsSync(LATEST_PATH)) {
    console.error(`[radar:llm] ERROR: ${LATEST_PATH} not found. Run 'npm run radar:generate:latest' first.`);
    process.exit(1);
  }

  const latest: LatestOutput = JSON.parse(fs.readFileSync(LATEST_PATH, "utf-8"));
  const top10 = latest.topRecommendations;
  if (top10.length === 0) {
    console.error("[radar:llm] ERROR: topRecommendations is empty.");
    process.exit(1);
  }

  console.log(`[radar:llm] Loaded ${top10.length} recommendations from data/latest.json`);

  // 2. Check API key
  const config = loadLlmConfig();

  if (!config) {
    console.log("[radar:llm] INFO: INFO_RADAR_LLM_API_KEY not set — skipping LLM call.");

    const llmMeta: LlmMeta = {
      status: "skipped_no_api_key",
      model: process.env["INFO_RADAR_LLM_MODEL"] ?? "gpt-4o-mini",
      baseUrlConfigured: !!process.env["INFO_RADAR_LLM_BASE_URL"],
      itemCount: 0,
    };

    writeOutput(latest, latest.llmReport.summary, latest.llmReport.markdown, llmMeta);
    return;
  }

  console.log(
    `[radar:llm] Using model: ${config.model}` +
      (config.baseUrl !== "https://api.openai.com/v1" ? ` @ ${config.baseUrl}` : ""),
  );

  // 3. Build compact prompt
  const promptItems: LlmPromptItem[] = top10.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    url: item.url,
    summary: (item.summary ?? "").slice(0, 600),
    tags: item.tags,
    score: item.score,
    scoreBreakdown: item.scoreBreakdown as unknown as Record<string, number>,
    metrics: item.metrics as Record<string, unknown>,
    publishedAt: item.publishedAt,
  }));

  const sourceSummary = `来源: ${latest.sources.join(", ")} | 共 ${latest.candidates.length} 条候选`;
  const prompt = buildEnrichmentPrompt(promptItems, latest.date, sourceSummary);

  // 4. Call LLM
  const client = new LlmClient(config);

  let llmMeta: LlmMeta;
  let enrichedItems: RecommendationItem[] = top10;
  let reportSummary: string | null = latest.llmReport.summary;
  let reportMarkdown: string | null = latest.llmReport.markdown;

  try {
    console.log(`[radar:llm] Calling LLM...`);
    const raw = await client.chat(
      [
        { role: "system", content: "你是一个专业的信息分析助手。只返回严格 JSON，不要 Markdown 包裹，不要额外解释。" },
        { role: "user", content: prompt },
      ],
      { temperature: 0.3, maxTokens: 4096 },
    );

    console.log(`[radar:llm] LLM responded with ${raw.length} chars.`);

    // 5. Parse
    const jsonText = extractJson(raw);
    let parsed: LlmResponse;
    try {
      parsed = JSON.parse(jsonText) as LlmResponse;
    } catch (parseErr) {
      throw new Error(`JSON parse failed: ${String(parseErr)}. Raw (first 200): ${jsonText.slice(0, 200)}`);
    }

    // 6. Validate & merge
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("LLM response missing 'items' array");
    }

    enrichedItems = validateAndMerge(top10, parsed);

    // Merge report
    if (parsed.report) {
      const rep = parsed.report as LlmReportEnrichment;
      if (rep.summary && typeof rep.summary === "string" && rep.summary.trim().length > 0) {
        reportSummary = rep.summary.trim().slice(0, 400);
      }
      if (rep.markdown && typeof rep.markdown === "string" && rep.markdown.trim().length > 0) {
        reportMarkdown = rep.markdown.trim().slice(0, 8000);
      }
    }

    const enrichedCount = enrichedItems.filter(
      (item) => item.llmSummary || item.llmRecommendationReason || item.llmRiskNote,
    ).length;

    llmMeta = {
      status: "ok",
      model: config.model,
      baseUrlConfigured: true,
      itemCount: enrichedCount,
    };

    console.log(`[radar:llm] Enriched ${enrichedCount}/${top10.length} items.`);
  } catch (err: unknown) {
    console.error(`[radar:llm] LLM call failed: ${String(err)}`);

    llmMeta = {
      status: "failed",
      model: config.model,
      baseUrlConfigured: true,
      itemCount: 0,
      errorMessage: String(err).slice(0, 500),
    };
  }

  // 7. Write output
  writeOutput(
    { ...latest, topRecommendations: enrichedItems },
    reportSummary,
    reportMarkdown,
    llmMeta,
  );
}

// ---------------------------------------------------------------------------
// Write helper
// ---------------------------------------------------------------------------

function writeOutput(
  latest: LatestOutput,
  reportSummary: string | null,
  reportMarkdown: string | null,
  llmMeta: LlmMeta,
): void {
  const output = {
    ...latest,
    llmReport: {
      ...latest.llmReport,
      enabled: llmMeta.status === "ok",
      status: llmMeta.status,
      summary: reportSummary ?? latest.llmReport.summary,
      markdown: reportMarkdown ?? latest.llmReport.markdown,
    },
    _meta: {
      task: "Task 4A LLM preview",
      generatedAt: new Date().toISOString(),
      llm: llmMeta,
    },
  };

  const outDir = path.dirname(OUT_PATH);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`\n[radar:llm] Done.`);
  console.log(`  Output: ${OUT_PATH}`);
  console.log(`  LLM status: ${llmMeta.status}`);
  console.log(`  data/latest.json was NOT modified.`);
}

main().catch((err) => {
  console.error("[radar:llm] Fatal error:", err);
  process.exit(1);
});
