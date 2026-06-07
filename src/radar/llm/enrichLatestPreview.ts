/**
 * Task 4A: LLM enrichment preview.
 *
 * Reads data/latest.json, sends Top 10 to an OpenAI-compatible LLM,
 * writes enriched output to data/generated/latest_llm_preview.json.
 *
 * When INFO_RADAR_LLM_API_KEY is not set → skipped_no_api_key.
 * On JSON parse failure → auto-retry once with a shorter prompt.
 */

import fs from "node:fs";
import path from "node:path";
import type { LatestOutput, RecommendationItem } from "../processors/buildOutput.ts";
import { loadLlmConfig, LlmClient, type LlmChatResult } from "./client.ts";
import { buildEnrichmentPrompt, buildRetryPrompt, type LlmPromptItem } from "./prompt.ts";
import type { LlmItemEnrichment, LlmMeta, LlmReportEnrichment, LlmResponse } from "./types.ts";

const LATEST_PATH = path.resolve("data", "latest.json");
const OUT_PATH = path.resolve("data", "generated", "latest_llm_preview.json");

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  let result = text.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```(?:json)?\s*\n?/, "");
    result = result.replace(/\n?```\s*$/, "");
  }
  return result.trim();
}

function trimField(val: unknown, maxChars: number): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxChars);
}

// ---------------------------------------------------------------------------
// Merge LLM output into items
// ---------------------------------------------------------------------------

function mergeItems(items: RecommendationItem[], parsed: LlmResponse): RecommendationItem[] {
  const map = new Map<string, LlmItemEnrichment>();
  for (const li of parsed.items ?? []) {
    if (li && typeof li.id === "string") map.set(li.id, li);
  }
  return items.map((item) => {
    const e = map.get(item.id);
    if (!e) return item;
    return {
      ...item,
      llmSummary: trimField(e.llmSummary, 80) || null,
      llmRecommendationReason: trimField(e.llmRecommendationReason, 120) || null,
      llmRiskNote: trimField(e.llmRiskNote, 120) || null,
    };
  });
}

// ---------------------------------------------------------------------------
// Diagnostics from LLM result
// ---------------------------------------------------------------------------

function diagFromResult(raw: string, result: LlmChatResult): Partial<LlmMeta> {
  return {
    rawLength: raw.length,
    rawPreviewStart: raw.slice(0, 200),
    rawPreviewEnd: raw.slice(-200),
    finishReason: result.finishReason,
    usage: result.usage,
  };
}

// ---------------------------------------------------------------------------
// Single LLM call + parse
// ---------------------------------------------------------------------------

interface CallResult {
  enrichedItems: RecommendationItem[];
  reportSummary: string | null;
  reportMarkdown: string | null;
  enrichedCount: number;
  diag: Partial<LlmMeta>;
}

async function callAndParse(
  client: LlmClient,
  systemPrompt: string,
  userPrompt: string,
  items: RecommendationItem[],
): Promise<CallResult> {
  const raw = await client.chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  console.log(`[radar:llm] LLM responded: ${raw.content.length} chars, finish: ${raw.finishReason ?? "?"}`);

  const jsonText = extractJson(raw.content);
  const parsed = JSON.parse(jsonText) as LlmResponse;

  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error("LLM response missing 'items' array");
  }

  const enrichedItems = mergeItems(items, parsed);

  let reportSummary: string | null = null;
  let reportMarkdown: string | null = null;
  if (parsed.report) {
    const r = parsed.report as LlmReportEnrichment;
    if (typeof r.summary === "string" && r.summary.trim()) {
      reportSummary = r.summary.trim().slice(0, 300);
    }
    if (typeof r.markdown === "string" && r.markdown.trim()) {
      reportMarkdown = r.markdown.trim().slice(0, 6000);
    }
  }

  const enrichedCount = enrichedItems.filter(
    (it) => it.llmSummary || it.llmRecommendationReason || it.llmRiskNote,
  ).length;

  return { enrichedItems, reportSummary, reportMarkdown, enrichedCount, diag: diagFromResult(raw.content, raw) };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[radar:llm] Task 4A — LLM enrichment preview...");

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

  console.log(`[radar:llm] Loaded ${top10.length} recommendations.`);

  // ── No API key ──
  const config = loadLlmConfig();
  if (!config) {
    console.log("[radar:llm] INFO: INFO_RADAR_LLM_API_KEY not set — skipping LLM call.");
    writeOutput(latest, latest.llmReport.summary, latest.llmReport.markdown, {
      status: "skipped_no_api_key",
      model: process.env["INFO_RADAR_LLM_MODEL"] ?? "gpt-4o-mini",
      baseUrlConfigured: !!process.env["INFO_RADAR_LLM_BASE_URL"],
      itemCount: 0,
    });
    return;
  }

  console.log(
    `[radar:llm] Model: ${config.model} | max_tokens: ${config.maxTokens} | json_mode: ${config.jsonMode}` +
      (config.baseUrl !== "https://api.openai.com/v1" ? ` | base: ${config.baseUrl}` : ""),
  );

  // ── Build prompt items (compact) ──
  const promptItems: LlmPromptItem[] = top10.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    url: item.url,
    summary: (item.summary ?? "").slice(0, 300),
    tags: (item.tags ?? []).slice(0, 6),
    score: item.score,
    scoreBreakdown: item.scoreBreakdown as unknown as Record<string, number>,
    metrics: item.metrics as Record<string, unknown>,
    publishedAt: item.publishedAt,
  }));

  const sourceSummary = `${latest.sources.join("、")} | ${latest.candidates.length}条候选`;
  const sysPrompt = "你是专业的信息分析助手。只返回严格 JSON，不要代码块，不要解释。";

  const client = new LlmClient(config);

  let llmMeta: LlmMeta;
  let enrichedItems = top10;
  let reportSummary: string | null = latest.llmReport.summary;
  let reportMarkdown: string | null = latest.llmReport.markdown;

  // ── Attempt 1: full prompt ──
  try {
    console.log("[radar:llm] Attempt 1 — full enrichment...");
    const result = await callAndParse(
      client,
      sysPrompt,
      buildEnrichmentPrompt(promptItems, latest.date, sourceSummary),
      top10,
    );
    enrichedItems = result.enrichedItems;
    reportSummary = result.reportSummary;
    reportMarkdown = result.reportMarkdown;
    llmMeta = {
      status: "ok", model: config.model, baseUrlConfigured: true,
      itemCount: result.enrichedCount, retryCount: 0, ...result.diag,
    };
    console.log(`[radar:llm] Enriched ${result.enrichedCount}/${top10.length} items.`);
  } catch (err: unknown) {
    console.error(`[radar:llm] Attempt 1 failed: ${String(err).slice(0, 200)}`);

    // ── Attempt 2: retry with shorter prompt ──
    try {
      console.log("[radar:llm] Attempt 2 — retry with shorter prompt...");
      const result = await callAndParse(
        client,
        sysPrompt,
        buildRetryPrompt(promptItems, latest.date),
        top10,
      );
      enrichedItems = result.enrichedItems;
      reportSummary = result.reportSummary;  // retry only gives summary, no markdown
      reportMarkdown = null;                 // markdown not requested in retry
      llmMeta = {
        status: "ok", model: config.model, baseUrlConfigured: true,
        itemCount: result.enrichedCount, retryCount: 1, ...result.diag,
      };
      console.log(`[radar:llm] Retry succeeded — enriched ${result.enrichedCount}/${top10.length} items.`);
    } catch (retryErr: unknown) {
      console.error(`[radar:llm] Attempt 2 also failed: ${String(retryErr).slice(0, 200)}`);

      llmMeta = {
        status: "failed", model: config.model, baseUrlConfigured: true,
        itemCount: 0, retryCount: 1,
        errorMessage: `Attempt1: ${String(err).slice(0, 250)} | Attempt2: ${String(retryErr).slice(0, 250)}`,
      };
    }
  }

  writeOutput({ ...latest, topRecommendations: enrichedItems }, reportSummary, reportMarkdown, llmMeta);
}

// ---------------------------------------------------------------------------
// Write
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
