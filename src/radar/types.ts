/** Data source identifier — grows with each new fetcher. */
export type RadarSource = "hackernews" | "devto" | "github" | "arxiv";

// ---------------------------------------------------------------------------
// RawRadarItem — Task 2 output
// ---------------------------------------------------------------------------

/**
 * A single raw item produced by a fetcher.
 *
 * This type intentionally does **not** contain `score`, `scoreBreakdown`,
 * `llmSummary`, `llmRecommendationReason`, or `llmRiskNote`. Those fields
 * belong to Task 3 (scoring) and Task 4 (LLM).
 */
export interface RawRadarItem {
  /** Unique id scoped to this project (e.g. "hackernews:12345") */
  id: string;
  /** Which source this item came from */
  source: RadarSource;
  /** Original id from the source API (e.g. HN objectID) */
  sourceId: string;
  /** Item title */
  title: string;
  /** Public URL to the original content */
  url: string;
  /** ISO-8601 publish date, or null when the source does not provide one */
  publishedAt: string | null;
  /** Short summary / description (not LLM-generated) */
  summary: string;
  /** Tags extracted from the source or matched against keywords */
  tags: string[];
  /** Raw metrics from the source — structure varies per source */
  metrics: RawRadarMetrics;
  /** The original API response blob (for debugging / later enrichment) */
  raw?: unknown;
}

export interface RawRadarMetrics {
  points?: number;
  comments?: number;
  stars?: number;
  forks?: number;
  likes?: number;
}

// ---------------------------------------------------------------------------
// FetcherResult — per-source fetch outcome
// ---------------------------------------------------------------------------

export interface FetcherResult {
  source: RadarSource;
  /** false when every query / attempt failed for this source */
  ok: boolean;
  items: RawRadarItem[];
  /** Non-fatal warning (e.g. 3/4 queries succeeded) */
  warning?: string;
  /** Fatal error message (when ok=false) */
  error?: string;
  /** ISO-8601 timestamp of when the fetch completed */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// Raw output envelope — written to data/raw/
// ---------------------------------------------------------------------------

export interface RawOutput {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO-8601
  sources: string[];
  stats: {
    totalFetched: number;
    sourceCount: number;
    successSourceCount: number;
    failedSourceCount: number;
  };
  results: FetcherResult[];
  /** Flattened items from all successful results (raw order, no dedupe) */
  items: RawRadarItem[];
}
