/**
 * ArXiv fetcher — official Atom/XML API.
 *
 * Strategy: run 2-3 search queries serially with a 3 s delay between each
 * (ArXiv API etiquette), parse the Atom XML with fast-xml-parser, then
 * return a single FetcherResult. Deduplicated by arxiv ID within the fetcher.
 *
 * API docs: https://info.arxiv.org/help/api/
 *
 * This file is a clean-room implementation.
 */

import { XMLParser } from "fast-xml-parser";
import type { FetcherResult, RawRadarItem } from "../types.ts";
import { fetchText, FetchError } from "../utils/http.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ARXIV_API_BASE = "https://export.arxiv.org/api/query";

/** Queries run serially. Each fetches recent AI/ML papers. */
const QUERIES: Array<{ searchQuery: string; label: string }> = [
  { searchQuery: 'all:"large language model"', label: "LLM" },
  { searchQuery: 'all:"retrieval augmented generation"', label: "RAG" },
  { searchQuery: 'all:"AI agent" OR all:"multi-agent"', label: "AI Agent" },
];

const MAX_RESULTS = 5;
const DELAY_MS = 3_000; // ArXiv asks for ≥ 3 s between requests

// ---------------------------------------------------------------------------
// Atom / fast-xml-parser types (subset)
// ---------------------------------------------------------------------------

interface AtomAuthor {
  name: string;
}

interface AtomLink {
  "@_href"?: string;
  "@_rel"?: string;
  "@_type"?: string;
}

interface AtomCategory {
  "@_term"?: string;
}

interface AtomEntry {
  id?: string;
  title?: string;
  summary?: string;
  published?: string;
  updated?: string;
  author?: AtomAuthor | AtomAuthor[];
  category?: AtomCategory | AtomCategory[];
  link?: AtomLink | AtomLink[];
}

interface AtomFeed {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract arxiv ID from an entry <id> like "http://arxiv.org/abs/2606.12345v1". */
function extractArxivId(rawId: string): string | null {
  // Typical formats:
  //   http://arxiv.org/abs/2606.12345v1
  //   http://arxiv.org/abs/quant-ph/0201234
  const m = rawId.match(/arxiv\.org\/abs\/([^\/\s]+)/);
  return m?.[1] ?? null;
}

function toArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function cleanText(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

/** Extract the best public URL from entry links. */
function extractUrl(links: AtomLink[], arxivId: string): string {
  for (const link of links) {
    if (link["@_rel"] === "alternate" && link["@_href"]) return link["@_href"];
  }
  return `https://arxiv.org/abs/${arxivId}`;
}

// ---------------------------------------------------------------------------
// XML parse
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

function parseAtomXml(xml: string): AtomEntry[] {
  const parsed = parser.parse(xml) as AtomFeed;
  if (!parsed.feed?.entry) return [];
  return Array.isArray(parsed.feed.entry) ? parsed.feed.entry : [parsed.feed.entry];
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

function normalizeEntry(entry: AtomEntry, queryLabel: string): RawRadarItem | null {
  const rawId = entry.id ?? "";
  const arxivId = extractArxivId(rawId);
  if (!arxivId) return null;

  const title = cleanText(entry.title);
  if (!title) return null;

  const links = toArray(entry.link);
  const url = extractUrl(links, arxivId);

  const summary = cleanText(entry.summary);
  const authors = toArray(entry.author).map((a) => a.name ?? "Unknown").filter(Boolean);
  const categories = toArray(entry.category)
    .map((c) => c["@_term"] ?? "")
    .filter(Boolean);

  const publishedAt = entry.published ?? entry.updated ?? null;

  const tags = ["ArXiv", queryLabel, ...categories.slice(0, 3)];

  return {
    id: `arxiv:${arxivId}`,
    source: "arxiv",
    sourceId: arxivId,
    title,
    url,
    publishedAt,
    summary: summary.slice(0, 800), // keep generous but bounded
    tags: [...new Set(tags)], // dedupe tags
    metrics: {}, // ArXiv has no stars/forks/comments
    raw: {
      arxivId,
      published: entry.published ?? null,
      updated: entry.updated ?? null,
      authors,
      categories,
      links: links.map((l) => ({ href: l["@_href"] ?? "", rel: l["@_rel"] ?? "" })),
      queryLabel,
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchArxivItems(): Promise<FetcherResult> {
  const now = new Date().toISOString();
  const seen = new Map<string, RawRadarItem>();
  const errors: string[] = [];

  for (let i = 0; i < QUERIES.length; i++) {
    const { searchQuery, label } = QUERIES[i]!;

    if (i > 0) {
      console.log(`  [arxiv] Waiting ${DELAY_MS / 1000}s before next query...`);
      await sleep(DELAY_MS);
    }

    try {
      const params = new URLSearchParams({
        search_query: searchQuery,
        start: "0",
        max_results: String(MAX_RESULTS),
        sortBy: "submittedDate",
        sortOrder: "descending",
      });
      const url = `${ARXIV_API_BASE}?${params}`;

      const xml = await fetchText(url, { timeoutMs: 30_000 });

      const entries = parseAtomXml(xml);
      let added = 0;
      for (const entry of entries) {
        const item = normalizeEntry(entry, label);
        if (item && !seen.has(item.sourceId)) {
          seen.set(item.sourceId, item);
          added++;
        }
      }
      console.log(`  [arxiv] "${label}": ${added} papers (${entries.length} entries parsed)`);
    } catch (err: unknown) {
      const msg = err instanceof FetchError ? err.message : `"${label}": ${String(err)}`;
      errors.push(msg);
      console.error(`  [arxiv] ${msg}`);
    }
  }

  const items = [...seen.values()];

  if (items.length === 0) {
    return {
      source: "arxiv",
      ok: false,
      items: [],
      error:
        errors.length > 0
          ? `All ${QUERIES.length} queries failed. Errors: ${errors.join("; ")}`
          : "No papers returned from any query (all results empty).",
      fetchedAt: now,
    };
  }

  const warning =
    errors.length > 0
      ? `${errors.length}/${QUERIES.length} queries failed: ${errors.join("; ")}`
      : undefined;

  return {
    source: "arxiv",
    ok: true,
    items,
    warning,
    fetchedAt: now,
  };
}
