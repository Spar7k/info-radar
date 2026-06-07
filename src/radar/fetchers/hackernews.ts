/**
 * Hacker News fetcher — Algolia Search API.
 *
 * Strategy: run multiple keyword queries in parallel, deduplicate by
 * HN objectID within this fetcher, then return a single FetcherResult.
 *
 * API docs: https://hn.algolia.com/api
 *
 * This file is a clean-room implementation. It does NOT copy code from
 * the agents-radar reference project.
 */

import type { FetcherResult, RawRadarItem } from "../types.ts";
import { fetchJson, FetchError } from "../utils/http.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HN_ALGOLIA_BASE = "https://hn.algolia.com/api/v1/search_by_date";

/** Queries run in parallel. */
const QUERIES = [
  "ai agent",
  "llm",
  "rag",
  "mcp",
  "workflow",
  "developer tools",
];

const HITS_PER_QUERY = 5;

// ---------------------------------------------------------------------------
// Algolia API types (subset we care about)
// ---------------------------------------------------------------------------

interface AlgoliaHit {
  objectID: string;
  title: string | null;
  story_title?: string | null;
  url?: string | null;
  story_url?: string | null;
  story_text?: string;
  points?: number;
  num_comments?: number;
  created_at: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

const AI_KEYWORDS = /ai|agent|llm|rag|mcp|workflow|claude|openai|gpt|anthropic|machine.learning|vector|embedding|langchain/i;

function extractTags(hit: AlgoliaHit, query: string): string[] {
  const tags: string[] = [];

  // Always tag with source
  if (!tags.includes("Hacker News")) tags.push("Hacker News");

  // Add the matched query keyword
  const q = query.trim();
  if (q && !tags.some((t) => t.toLowerCase() === q.toLowerCase())) {
    tags.push(q);
  }

  // Extract AI-related tags from title
  const title = (hit.title ?? hit.story_title ?? "").toLowerCase();
  const keywordHits: string[] = [];
  if (/\bai\b|\bagent\b/i.test(title)) keywordHits.push("AI Agent");
  if (/\bllm\b|language.?model/i.test(title)) keywordHits.push("LLM");
  if (/\brag\b/i.test(title)) keywordHits.push("RAG");
  if (/\bmcp\b/i.test(title)) keywordHits.push("MCP");
  if (/\bworkflow|automation\b/i.test(title)) keywordHits.push("Workflow");
  if (/\bopen.?source\b/i.test(title)) keywordHits.push("Open Source");

  for (const k of keywordHits) {
    if (!tags.includes(k)) tags.push(k);
  }

  return tags;
}

function normalizeHit(hit: AlgoliaHit, query: string): RawRadarItem {
  const title = hit.title ?? hit.story_title ?? "Untitled";
  const url =
    hit.url ??
    hit.story_url ??
    `https://news.ycombinator.com/item?id=${hit.objectID}`;

  const summary = cleanSummary(
    hit.story_text ?? title,
  );

  const tags = extractTags(hit, query);

  return {
    id: `hackernews:${hit.objectID}`,
    source: "hackernews",
    sourceId: hit.objectID,
    title,
    url,
    publishedAt: hit.created_at || null,
    summary,
    tags,
    metrics: {
      points: hit.points ?? 0,
      comments: hit.num_comments ?? 0,
    },
    raw: hit,
  };
}

function cleanSummary(text: string, maxLen = 300): string {
  // Remove HTML tags, normalize whitespace
  let result = text.replace(/<[^>]+>/g, " ");
  result = result.replace(/&#x27;/g, "'");
  result = result.replace(/&amp;/g, "&");
  result = result.replace(/&lt;/g, "<");
  result = result.replace(/&gt;/g, ">");
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/\s+/g, " ").trim();

  if (result.length > maxLen) {
    result = result.slice(0, maxLen) + "...";
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchHackerNewsItems(): Promise<FetcherResult> {
  const now = new Date().toISOString();
  const seen = new Map<string, RawRadarItem>();
  const errors: string[] = [];

  await Promise.all(
    QUERIES.map(async (query) => {
      try {
        const params = new URLSearchParams({
          tags: "story",
          query,
          hitsPerPage: String(HITS_PER_QUERY),
        });
        const url = `${HN_ALGOLIA_BASE}?${params}`;

        const data = await fetchJson<AlgoliaResponse>(url);

        for (const hit of data.hits ?? []) {
          if (!hit.objectID) continue;
          if (!hit.title && !hit.story_title) continue; // skip empty titles
          if (
            hit.url === null &&
            hit.story_url === null &&
            !hit.title &&
            !hit.story_title
          ) {
            continue;
          }

          if (!seen.has(hit.objectID)) {
            seen.set(hit.objectID, normalizeHit(hit, query));
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof FetchError
            ? err.message
            : `"${query}": ${String(err)}`;
        errors.push(msg);
        console.error(`  [hackernews] ${msg}`);
      }
    }),
  );

  const items = [...seen.values()];

  if (items.length === 0) {
    return {
      source: "hackernews",
      ok: false,
      items: [],
      error:
        errors.length > 0
          ? `All ${QUERIES.length} queries failed. Errors: ${errors.join("; ")}`
          : "No stories returned from any query (all results empty).",
      fetchedAt: now,
    };
  }

  const warning =
    errors.length > 0
      ? `${errors.length}/${QUERIES.length} queries failed: ${errors.join("; ")}`
      : undefined;

  return {
    source: "hackernews",
    ok: true,
    items,
    warning,
    fetchedAt: now,
  };
}
