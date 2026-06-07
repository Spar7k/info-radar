/**
 * Dev.to fetcher — Forem public API.
 *
 * Strategy: query multiple tags in parallel, deduplicate by article id,
 * then return a single FetcherResult.
 *
 * API docs: https://developers.forem.com/api
 *
 * This file is a clean-room implementation.
 */

import type { FetcherResult, RawRadarItem } from "../types.ts";
import { fetchJson, FetchError } from "../utils/http.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEVTO_API_BASE = "https://dev.to/api/articles";

/** Tags queried in parallel. Keep per_page low to stay friendly to the API. */
const TAGS = ["ai", "machinelearning", "webdev", "javascript", "productivity", "opensource"];

const PER_PAGE = 8;

// ---------------------------------------------------------------------------
// Forem API types (subset)
// ---------------------------------------------------------------------------

interface DevtoArticle {
  id: number;
  title: string;
  url: string;
  description: string;
  published_at: string | null;
  created_at: string;
  tag_list: string | string[];
  comments_count: number;
  public_reactions_count: number;
  positive_reactions_count: number;
  user: { name: string };
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

function normalizeArticle(article: DevtoArticle, queriedTag: string): RawRadarItem {
  // tag_list may be a string (csv) or an array — normalise
  const rawTags: string[] =
    typeof article.tag_list === "string"
      ? article.tag_list.split(",").map((t) => t.trim()).filter(Boolean)
      : Array.isArray(article.tag_list)
        ? article.tag_list
        : [];

  const tags = ["Dev.to", queriedTag, ...rawTags.filter((t) => t !== queriedTag)];

  const publishedAt = article.published_at ?? article.created_at ?? null;

  const summary =
    (article.description ?? "").trim().length > 0
      ? article.description!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300)
      : article.title;

  return {
    id: `devto:${article.id}`,
    source: "devto",
    sourceId: String(article.id),
    title: article.title,
    url: article.url,
    publishedAt,
    summary: summary || article.title,
    tags,
    metrics: {
      comments: article.comments_count ?? 0,
      likes: article.public_reactions_count ?? article.positive_reactions_count ?? 0,
    },
    raw: article,
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchDevToItems(): Promise<FetcherResult> {
  const now = new Date().toISOString();
  const seen = new Map<number, RawRadarItem>();
  const errors: string[] = [];

  await Promise.all(
    TAGS.map(async (tag) => {
      try {
        const params = new URLSearchParams({
          tag,
          per_page: String(PER_PAGE),
          top: "7", // top articles from the past 7 days
        });
        const url = `${DEVTO_API_BASE}?${params}`;

        const articles = await fetchJson<DevtoArticle[]>(url);

        for (const article of articles) {
          // Skip items with empty title or url
          if (!article.title?.trim()) continue;
          if (!article.url?.trim()) continue;

          if (!seen.has(article.id)) {
            seen.set(article.id, normalizeArticle(article, tag));
          }
        }
      } catch (err: unknown) {
        const msg =
          err instanceof FetchError ? err.message : `"${tag}": ${String(err)}`;
        errors.push(msg);
        console.error(`  [devto] ${msg}`);
      }
    }),
  );

  const items = [...seen.values()];

  if (items.length === 0) {
    return {
      source: "devto",
      ok: false,
      items: [],
      error:
        errors.length > 0
          ? `All ${TAGS.length} tag queries failed. Errors: ${errors.join("; ")}`
          : "No articles returned from any tag query (all results empty).",
      fetchedAt: now,
    };
  }

  const warning =
    errors.length > 0
      ? `${errors.length}/${TAGS.length} tag queries failed: ${errors.join("; ")}`
      : undefined;

  return {
    source: "devto",
    ok: true,
    items,
    warning,
    fetchedAt: now,
  };
}
