/**
 * Shared pipeline: read raw → dedupe → score → sort → build output object.
 *
 * Used by both generateLatestPreview.ts and generateLatest.ts to avoid
 * code duplication between preview and formal output paths.
 */

import fs from "node:fs";
import path from "node:path";
import type { RawOutput, RawRadarItem } from "../types.ts";
import { dedupeItems, type DedupeStats } from "./dedupe.ts";
import { scoreItems, type ScoreResult, type ScoreBreakdown } from "./score.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScoredItem = RawRadarItem & ScoreResult;

export interface LatestOutput {
  date: string;
  generatedAt: string;
  stats: {
    totalFetched: number;
    totalAfterDedupe: number;
    totalScored: number;
    recommendationCount: number;
  };
  sources: string[];
  keywords: string[];
  topRecommendations: RecommendationItem[];
  candidates: CandidateItem[];
  llmReport: {
    enabled: boolean;
    provider: string;
    model: string;
    status: string;
    title: string;
    summary: string;
    markdown: string | null;
  };
  email: {
    enabled: boolean;
    status: string;
    lastSentAt: string | null;
  };
}

export interface RecommendationItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  tags: string[];
  metrics: Record<string, unknown>;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  ruleReasonHints: string[];
  llmSummary: string | null;
  llmRecommendationReason: string | null;
  llmRiskNote: string | null;
}

export interface CandidateItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  tags: string[];
  score: number;
}

export interface PipelineMeta {
  dedupeStats: DedupeStats;
  rawTotalFetched: number;
  sourceStatus: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RAW_PATH = path.resolve("data", "raw", "latest_raw.json");

function extractKeywords(items: ScoredItem[], topN = 10): string[] {
  const freq = new Map<string, number>();
  const top = items.slice(0, Math.min(topN, items.length));
  for (const item of top) {
    for (const tag of item.tags) {
      if (tag === "Hacker News" || tag === "Dev.to" || tag === "ArXiv" || tag === "GitHub Trending") continue;
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);
}

function toRecommendation(item: ScoredItem): RecommendationItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    summary: item.summary,
    tags: item.tags,
    metrics: item.metrics as Record<string, unknown>,
    score: item.score,
    scoreBreakdown: item.scoreBreakdown,
    ruleReasonHints: item.ruleReasonHints,
    llmSummary: null,
    llmRecommendationReason: null,
    llmRiskNote: null,
  };
}

function toCandidate(item: ScoredItem): CandidateItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    summary: item.summary,
    tags: item.tags,
    score: item.score,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED_REC_FIELDS = [
  "id", "title", "url", "source", "score", "publishedAt",
  "scoreBreakdown", "tags", "summary",
  "llmSummary", "llmRecommendationReason", "llmRiskNote",
] as const;

const REQUIRED_BREAKDOWN_FIELDS = [
  "relevance", "practicality", "popularity", "freshness", "sourceQuality", "penalty",
] as const;

export function validateOutput(output: LatestOutput): void {
  if (!Array.isArray(output.topRecommendations)) {
    throw new Error("Validation failed: topRecommendations is not an array");
  }
  if (output.topRecommendations.length === 0) {
    throw new Error("Validation failed: topRecommendations is empty");
  }
  if (output.topRecommendations.length > 10) {
    throw new Error("Validation failed: topRecommendations exceeds 10 items");
  }
  if (!Array.isArray(output.candidates)) {
    throw new Error("Validation failed: candidates is not an array");
  }

  for (let i = 0; i < output.topRecommendations.length; i++) {
    const rec = output.topRecommendations[i]!;
    for (const field of REQUIRED_REC_FIELDS) {
      if (!(field in rec)) {
        throw new Error(`Validation failed: topRecommendations[${i}] missing field "${field}"`);
      }
    }
    const bd = rec.scoreBreakdown;
    for (const field of REQUIRED_BREAKDOWN_FIELDS) {
      if (!(field in bd)) {
        throw new Error(`Validation failed: topRecommendations[${i}].scoreBreakdown missing field "${field}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Build pipeline
// ---------------------------------------------------------------------------

export interface BuildResult {
  output: LatestOutput;
  meta: PipelineMeta;
}

export function buildLatestOutput(raw: RawOutput, now: Date): BuildResult {
  const dateStr = now.toISOString().slice(0, 10);

  // 1. Dedupe
  const dedupeResult = dedupeItems(raw.items);

  // 2. Score
  const scored = scoreItems(dedupeResult.items);

  // 3. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 4. Top 10 + keywords
  const top10 = scored.slice(0, 10);
  const keywords = extractKeywords(scored);

  // 5. Source status
  const sourceStatus: Record<string, string> = {};
  for (const r of raw.results) {
    sourceStatus[r.source] = r.ok ? "ok" : "failed";
  }

  // 6. Build output
  const output: LatestOutput = {
    date: dateStr,
    generatedAt: now.toISOString(),
    stats: {
      totalFetched: raw.stats.totalFetched,
      totalAfterDedupe: dedupeResult.stats.after,
      totalScored: scored.length,
      recommendationCount: top10.length,
    },
    sources: raw.sources,
    keywords,
    topRecommendations: top10.map(toRecommendation),
    candidates: scored.map(toCandidate),
    llmReport: {
      enabled: false,
      provider: "none",
      model: "none",
      status: "rule-only",
      title: `信息雷达日报｜${dateStr}`,
      summary: `规则评分日报。共评分 ${scored.length} 条，推荐 ${top10.length} 条。`,
      markdown: null,
    },
    email: {
      enabled: false,
      status: "not_configured",
      lastSentAt: null,
    },
  };

  return {
    output,
    meta: {
      dedupeStats: dedupeResult.stats,
      rawTotalFetched: raw.stats.totalFetched,
      sourceStatus,
    },
  };
}

export function loadRawData(rawPath?: string): RawOutput {
  const rp = rawPath ?? RAW_PATH;
  if (!fs.existsSync(rp)) {
    throw new Error(`${rp} not found. Run 'npm run radar:fetch' first.`);
  }
  const raw = JSON.parse(fs.readFileSync(rp, "utf-8")) as RawOutput;
  if (!raw.items || raw.items.length === 0) {
    throw new Error("Raw items list is empty.");
  }
  return raw;
}
