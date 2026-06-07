/**
 * Rule-based scoring processor.
 *
 * Produces a score (0–100) and a scoreBreakdown compatible with the
 * existing data/latest.json contract. No LLM is involved.
 */

import type { RawRadarItem } from "../types.ts";

// ---------------------------------------------------------------------------
// Types — match the existing topRecommendations item contract
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  relevance: number;     // 0–30
  practicality: number;  // 0–25
  popularity: number;    // 0–20
  freshness: number;     // 0–15
  sourceQuality: number; // 0–10
  penalty: number;       // ≤ 0
}

export interface ScoreResult {
  score: number;
  scoreBreakdown: ScoreBreakdown;
  ruleReasonHints: string[];
}

// ---------------------------------------------------------------------------
// Source base weights
// ---------------------------------------------------------------------------

const SOURCE_WEIGHTS: Record<string, number> = {
  github: 18,
  arxiv: 18,      // academic papers have inherent quality
  hackernews: 15,
  devto: 12,
};

// Fallback for unknown sources
const DEFAULT_SOURCE_WEIGHT = 10;

// ---------------------------------------------------------------------------
// Keyword relevance patterns (case-insensitive)
// ---------------------------------------------------------------------------

const RELEVANCE_KEYWORDS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\bai.agent\b|\bmulti.agent\b|\bagent\b/i, weight: 3 },
  { pattern: /\bllm\b|large.language.model\b/i, weight: 3 },
  { pattern: /\brag\b|retrieval.augmented.generation\b/i, weight: 2 },
  { pattern: /\bmcp\b/i, weight: 2 },
  { pattern: /\bworkflow\b|\bautomation\b/i, weight: 2 },
  { pattern: /\bdeveloper.tool\b|\bdev.tool\b/i, weight: 2 },
  { pattern: /\bopen.source\b|\bgithub\b/i, weight: 2 },
  { pattern: /\bresearch\b|\bpaper\b|\bstudy\b/i, weight: 1 },
  { pattern: /\bproduct\b|\blaunch\b|\brelease\b/i, weight: 1 },
];

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function calcRelevance(item: RawRadarItem): { score: number; hints: string[] } {
  let score = 15; // base
  const hints: string[] = [];

  const searchText = `${item.title} ${item.tags.join(" ")} ${item.summary}`;

  for (const kw of RELEVANCE_KEYWORDS) {
    if (kw.pattern.test(searchText)) {
      score += kw.weight;
      const match = kw.pattern.source.replace(/\\b/g, "").replace(/\|/g, " / ");
      if (!hints.some((h) => h.includes(match.slice(0, 10)))) {
        hints.push(`命中关键词: ${match.slice(0, 40)}`);
      }
    }
  }

  return {
    score: Math.min(30, score),
    hints,
  };
}

function calcPracticality(item: RawRadarItem): number {
  // Higher practicality for articles/tutorials vs pure news
  const sourceScores: Record<string, number> = {
    devto: 20,       // tutorials, how-tos
    github: 18,      // tools, libraries
    arxiv: 14,       // AI/ML research often directly applicable
    hackernews: 15,  // discussion — mixed
  };
  const base = sourceScores[item.source] ?? 12;

  // Bonus: longer summary suggests more substantive content
  const lengthBonus = Math.min(5, Math.floor(item.summary.length / 200));

  return Math.min(25, base + lengthBonus);
}

function calcPopularity(item: RawRadarItem): number {
  let raw = 0;

  const m = item.metrics;
  if (item.source === "hackernews") {
    raw = (m.points ?? 0) + (m.comments ?? 0) * 2;
  } else if (item.source === "devto") {
    raw = (m.likes ?? 0) + (m.comments ?? 0) * 2;
  } else if (item.source === "github") {
    raw = Math.floor(((m.stars ?? 0) + (m.forks ?? 0) * 2) / 50);
  } else if (item.source === "arxiv") {
    // ArXiv has no engagement metrics — give a baseline
    return 8;
  }

  // Cap at 15 — prevents engagement-heavy sources from overwhelming research
  return Math.min(15, Math.max(3, Math.floor(raw / 5)));
}

function calcFreshness(item: RawRadarItem): number {
  if (!item.publishedAt) return 6;

  const published = new Date(item.publishedAt).getTime();
  if (isNaN(published)) return 6;

  const hoursAgo = (Date.now() - published) / 3_600_000;
  const daysAgo = hoursAgo / 24;

  if (hoursAgo <= 24) return 25;
  if (daysAgo <= 7) return 20;
  if (daysAgo <= 30) return 12;
  return 5;
}

function calcSourceQuality(item: RawRadarItem): number {
  return SOURCE_WEIGHTS[item.source] ?? DEFAULT_SOURCE_WEIGHT;
}

function calcPenalty(item: RawRadarItem): number {
  let penalty = 0;

  // Penalize items missing publishedAt
  if (!item.publishedAt) penalty -= 1;

  // Penalize items with very short summaries
  if (item.summary.length < 30) penalty -= 1;

  return penalty;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scoreItem(item: RawRadarItem): ScoreResult {
  const relevance = calcRelevance(item);
  const practicality = calcPracticality(item);
  const popularity = calcPopularity(item);
  const freshness = calcFreshness(item);
  const sourceQuality = calcSourceQuality(item);
  const penalty = calcPenalty(item);

  const total =
    relevance.score +
    practicality +
    popularity +
    freshness +
    sourceQuality +
    penalty;

  const score = Math.max(0, Math.min(100, total));

  return {
    score,
    scoreBreakdown: {
      relevance: relevance.score,
      practicality,
      popularity,
      freshness,
      sourceQuality,
      penalty,
    },
    ruleReasonHints: relevance.hints,
  };
}

export function scoreItems(items: RawRadarItem[]): Array<RawRadarItem & ScoreResult> {
  return items.map((item) => {
    const result = scoreItem(item);
    return { ...item, ...result };
  });
}
