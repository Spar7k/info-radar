/**
 * Fetcher registry — collects all source fetchers and runs them in parallel.
 *
 * Each fetcher is called independently. One failing does not abort the others.
 * Results are returned as a flat FetcherResult[].
 *
 * This file is a clean-room implementation.
 */

import type { FetcherResult } from "../types.ts";
import { fetchHackerNewsItems } from "./hackernews.ts";
import { fetchDevToItems } from "./devto.ts";
import { fetchGitHubTrendingItems } from "./githubTrending.ts";
import { fetchArxivItems } from "./arxiv.ts";

export async function runFetchers(): Promise<FetcherResult[]> {
  // Each fetcher is a self-contained async function returning FetcherResult.
  // Wrap in Promise.allSettled so one crash never kills the others.
  const tasks: Array<{ label: string; fn: () => Promise<FetcherResult> }> = [
    { label: "hackernews", fn: fetchHackerNewsItems },
    { label: "devto", fn: fetchDevToItems },
    { label: "github", fn: fetchGitHubTrendingItems },
    { label: "arxiv", fn: fetchArxivItems },
  ];

  console.log(`[radar] Starting ${tasks.length} fetcher(s)...`);

  const results = await Promise.allSettled(
    tasks.map(async (t) => {
      console.log(`  [${t.label}] Fetching...`);
      const result = await t.fn();
      const status = result.ok
        ? `OK (${result.items.length} items)`
        : `FAILED${result.warning ? " (partial)" : ""}`;
      console.log(`  [${t.label}] ${status}`);
      if (result.warning) console.warn(`  [${t.label}] Warning: ${result.warning}`);
      if (result.error) console.error(`  [${t.label}] Error: ${result.error}`);
      return result;
    }),
  );

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;

    const task = tasks[i]!;
    return {
      source: task.label as FetcherResult["source"],
      ok: false,
      items: [],
      error: `Fetcher crashed: ${String(r.reason)}`,
      fetchedAt: new Date().toISOString(),
    } satisfies FetcherResult;
  });
}
