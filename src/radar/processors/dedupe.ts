/**
 * Deduplication processor — removes duplicate RawRadarItems.
 *
 * Three-layer dedupe (in order):
 * 1. Exact id match
 * 2. Normalized URL match (strip hash, utm params, trailing /)
 * 3. Normalized title match (lowercase, collapsed whitespace)
 *
 * When a duplicate is found, the item with more complete metrics is kept.
 */

import type { RawRadarItem } from "../types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DedupeStats {
  before: number;
  after: number;
  removed: number;
  byId: number;
  byUrl: number;
  byTitle: number;
}

export interface DedupeResult {
  items: RawRadarItem[];
  stats: DedupeStats;
}

// ---------------------------------------------------------------------------
// URL normalization
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = /[?&](?:utm_source|utm_medium|utm_campaign|utm_term|utm_content|ref|source|fbclid|gclid|mc_cid|mc_eid)=[^&]*/gi;

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  // Strip hash
  const hashIdx = url.indexOf("#");
  if (hashIdx >= 0) url = url.slice(0, hashIdx);
  // Strip tracking params
  url = url.replace(TRACKING_PARAMS, "");
  // Clean up trailing `?` or `&` after param removal
  url = url.replace(/[?&]$/, "");
  // Strip trailing /
  url = url.replace(/\/+$/, "");
  return url;
}

// ---------------------------------------------------------------------------
// Title normalization
// ---------------------------------------------------------------------------

function normalizeTitle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Metrics completeness score (higher = keep)
// ---------------------------------------------------------------------------

function metricsCompleteness(item: RawRadarItem): number {
  let score = 0;
  const m = item.metrics;
  if (m.points && m.points > 0) score += 1;
  if (m.comments && m.comments > 0) score += 1;
  if (m.stars && m.stars > 0) score += 2;
  if (m.forks && m.forks > 0) score += 1;
  if (m.likes && m.likes > 0) score += 1;
  // Prefer items with longer summaries
  if (item.summary.length > 50) score += 1;
  // Prefer items with more tags
  if (item.tags.length >= 3) score += 1;
  return score;
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

export function dedupeItems(items: RawRadarItem[]): DedupeResult {
  const before = items.length;

  // Layer 1: by id
  const byIdMap = new Map<string, RawRadarItem>();
  let byId = 0;
  for (const item of items) {
    const existing = byIdMap.get(item.id);
    if (existing) {
      byId++;
      if (metricsCompleteness(item) > metricsCompleteness(existing)) {
        byIdMap.set(item.id, item);
      }
    } else {
      byIdMap.set(item.id, item);
    }
  }

  // Layer 2: by normalized URL
  const byUrlMap = new Map<string, RawRadarItem>();
  let byUrl = 0;
  for (const item of byIdMap.values()) {
    const norm = normalizeUrl(item.url);
    const existing = byUrlMap.get(norm);
    if (existing) {
      byUrl++;
      if (metricsCompleteness(item) > metricsCompleteness(existing)) {
        byUrlMap.set(norm, item);
      }
    } else {
      byUrlMap.set(norm, item);
    }
  }

  // Layer 3: by normalized title
  const byTitleMap = new Map<string, RawRadarItem>();
  let byTitle = 0;
  for (const item of byUrlMap.values()) {
    const norm = normalizeTitle(item.title);
    const existing = byTitleMap.get(norm);
    if (existing) {
      byTitle++;
      if (metricsCompleteness(item) > metricsCompleteness(existing)) {
        byTitleMap.set(norm, item);
      }
    } else {
      byTitleMap.set(norm, item);
    }
  }

  const result = [...byTitleMap.values()];
  const after = result.length;
  const removed = before - after;

  return {
    items: result,
    stats: { before, after, removed, byId, byUrl, byTitle },
  };
}
