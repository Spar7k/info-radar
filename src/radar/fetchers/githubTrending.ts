/**
 * GitHub Trending fetcher — HTML page scraping.
 *
 * Strategy: fetch 1-3 trending pages (daily, typescript/daily, python/daily),
 * parse the HTML with regex to extract repo cards, then return a single
 * FetcherResult. Deduplicated by full_name within the fetcher.
 *
 * This file is a clean-room implementation. It does NOT copy code from
 * the agents-radar reference project.
 */

import type { FetcherResult, RawRadarItem } from "../types.ts";
import { fetchText, FetchError } from "../utils/http.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRENDING_BASE = "https://github.com/trending";

/** Pages to fetch. Each entry is [path, pageLabel]. */
const PAGES: Array<{ url: string; label: string }> = [
  { url: `${TRENDING_BASE}?since=daily`, label: "daily" },
  { url: `${TRENDING_BASE}/typescript?since=daily`, label: "typescript" },
  { url: `${TRENDING_BASE}/python?since=daily`, label: "python" },
];

const MAX_PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Parse helpers
// ---------------------------------------------------------------------------

/**
 * Parse a number string that may contain commas (e.g. "1,234" → 1234).
 * Returns 0 on unparseable input.
 */
function parseNumber(raw: string): number {
  const n = parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

interface ParsedRepo {
  fullName: string;
  owner: string;
  repo: string;
  description: string;
  language: string;
  totalStars: number;
  forks: number;
  starsToday: number;
}

/**
 * Extract repos from a GitHub Trending HTML page.
 *
 * The page uses <article class="Box-row"> blocks. We split on these and
 * extract fields with regex. If the HTML structure changes such that no
 * articles are found, returns an empty array (the fetcher will treat this
 * as a partial failure).
 */
function parseTrendingHtml(html: string): ParsedRepo[] {
  const repos: ParsedRepo[] = [];

  // Split on article boundaries
  const articlePat = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)(?=<article[^>]*class="[^"]*Box-row[^"]*"|<footer|$)/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = articlePat.exec(html)) !== null) {
    if (m[1]) blocks.push(m[1]);
  }

  // If the article-split approach produces nothing, fall back to a simpler
  // split on </article>
  if (blocks.length === 0) {
    const simpleBlocks = html.split(/<\/article>/i);
    for (const b of simpleBlocks) {
      if (b.includes("Box-row")) blocks.push(b);
    }
  }

  for (const block of blocks) {
    try {
      // fullName from <h2> → <a href="/owner/repo">
      const nameMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]+href="\/([^/"]+\/[^/"]+)"/);
      if (!nameMatch?.[1]) continue;
      const fullName = nameMatch[1].trim();

      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) continue;

      // description from <p>
      const descMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      const description = descMatch?.[1]
        ? descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
        : "";

      // language
      const langMatch = block.match(/itemprop="programmingLanguage"[^>]*>([\s\S]*?)<\//);
      const language = langMatch?.[1] ? langMatch[1].replace(/<[^>]+>/g, "").trim() : "";

      // Total stars — look for a link ending in /stargazers with a number
      const totalMatch = block.match(/\/stargazers"[^>]*>\s*(?:<[^>]+>\s*)*([\d,]+)/);
      const totalStars = totalMatch?.[1] ? parseNumber(totalMatch[1]) : 0;

      // Forks — look for a link ending in /forks with a number
      const forkMatch = block.match(/\/forks[^"]*"[^>]*>\s*(?:<[^>]+>\s*)*([\d,]+)/);
      const forks = forkMatch?.[1] ? parseNumber(forkMatch[1]) : 0;

      // Stars today — look for "X stars today" or "X stars today" text
      const todayMatch = block.match(/([\d,]+)\s+stars?\s+today/i);
      const starsToday = todayMatch?.[1] ? parseNumber(todayMatch[1]) : 0;

      repos.push({ fullName, owner, repo, description, language, totalStars, forks, starsToday });
    } catch {
      // single block parse failure is non-fatal
    }
  }

  return repos;
}

// ---------------------------------------------------------------------------
// Normalize
// ---------------------------------------------------------------------------

function normalizeRepo(repo: ParsedRepo, pageLabel: string): RawRadarItem {
  const tags = ["GitHub Trending", pageLabel];
  if (repo.language && !tags.includes(repo.language)) {
    tags.push(repo.language);
  }

  const abbreviation = repo.language
    ? `[${repo.language}] ${repo.description || repo.fullName}`
    : (repo.description || repo.fullName);

  return {
    id: `github:${repo.fullName}`,
    source: "github",
    sourceId: repo.fullName,
    title: repo.fullName,
    url: `https://github.com/${repo.fullName}`,
    publishedAt: null, // Trending page has no publish date
    summary: abbreviation.slice(0, 300),
    tags,
    metrics: {
      stars: repo.totalStars,
      forks: repo.forks,
    },
    raw: {
      fullName: repo.fullName,
      owner: repo.owner,
      repo: repo.repo,
      language: repo.language || null,
      starsToday: repo.starsToday,
      pageUrl: `${TRENDING_BASE}?since=daily`, // simplified
    },
  };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

export async function fetchGitHubTrendingItems(): Promise<FetcherResult> {
  const now = new Date().toISOString();
  const seen = new Map<string, RawRadarItem>();
  const errors: string[] = [];
  const warnings: string[] = [];

  await Promise.all(
    PAGES.map(async ({ url, label }) => {
      try {
        const html = await fetchText(url, {
          timeoutMs: 30_000,
          headers: {
            // Use a browser-like UA to avoid being blocked
            "User-Agent":
              "Mozilla/5.0 (compatible; info-radar/0.1; +https://github.com/info-radar)",
          },
        });

        const repos = parseTrendingHtml(html);

        if (repos.length === 0) {
          warnings.push(`"${label}": parsed 0 repos — HTML structure may have changed`);
          console.warn(`  [github] "${label}": parsed 0 repos`);
          return;
        }

        let added = 0;
        for (const repo of repos.slice(0, MAX_PER_PAGE)) {
          if (!seen.has(repo.fullName)) {
            seen.set(repo.fullName, normalizeRepo(repo, label));
            added++;
          }
        }
        console.log(`  [github] "${label}": ${added} new repos (${repos.length} parsed)`);
      } catch (err: unknown) {
        const msg =
          err instanceof FetchError ? err.message : `"${label}": ${String(err)}`;
        errors.push(msg);
        console.error(`  [github] ${msg}`);
      }
    }),
  );

  const items = [...seen.values()];

  if (items.length === 0) {
    const detail = errors.length > 0
      ? `All ${PAGES.length} pages failed. Errors: ${errors.join("; ")}`
      : "No repos parsed from any trending page.";
    return {
      source: "github",
      ok: false,
      items: [],
      error: detail,
      fetchedAt: now,
    };
  }

  // Build warning combining hard errors and soft parse warnings
  const allWarnings = [...warnings, ...errors.map((e) => `Error: ${e}`)];
  const warning = allWarnings.length > 0 ? allWarnings.join("; ") : undefined;

  return {
    source: "github",
    ok: true,
    items,
    warning,
    fetchedAt: now,
  };
}
