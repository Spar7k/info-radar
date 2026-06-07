/**
 * Task 5A: Generate email preview (HTML + plain text) from data/latest.json.
 *
 * Does NOT send mail.  Does NOT call any LLM.  Does NOT connect to SMTP.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types (subset of data/latest.json we need)
// ---------------------------------------------------------------------------

interface Rec {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  summary: string;
  tags: string[];
  score: number;
  llmSummary: string | null;
  llmRecommendationReason: string | null;
  llmRiskNote: string | null;
}

interface Report {
  summary: string | null;
  markdown: string | null;
}

interface Latest {
  date: string;
  generatedAt: string;
  sources: string[];
  stats: { totalFetched: number; totalAfterDedupe: number; totalScored: number; recommendationCount: number };
  keywords: string[];
  topRecommendations: Rec[];
  candidates: Rec[];
  llmReport: Report;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const LATEST_PATH = path.resolve("data", "latest.json");
const OUT_DIR = path.resolve("data", "generated");
const HTML_PATH = path.join(OUT_DIR, "email_preview.html");
const TXT_PATH = path.join(OUT_DIR, "email_preview.txt");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_NAMES: Record<string, string> = {
  hackernews: "Hacker News",
  devto: "Dev.to",
  arxiv: "ArXiv",
  github: "GitHub",
};

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function or(str: string | null | undefined, fallback: string): string {
  const s = (str ?? "").trim();
  return s.length > 0 ? s : fallback;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sourceDist(top10: Rec[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const r of top10) {
    dist[r.source] = (dist[r.source] ?? 0) + 1;
  }
  return dist;
}

// ---------------------------------------------------------------------------
// Plain-text render
// ---------------------------------------------------------------------------

function renderText(latest: Latest): string {
  const top5 = latest.topRecommendations.slice(0, 5);
  const more5 = latest.topRecommendations.slice(5, 10);
  const dist = sourceDist(latest.topRecommendations);
  const summary = or(latest.llmReport.summary, `今日共筛选出 ${latest.stats.recommendationCount} 条重点信息，覆盖 ${latest.sources.map((s) => SOURCE_NAMES[s] ?? s).join("、")}。`);

  const lines: string[] = [];
  lines.push("========================================");
  lines.push("  agent雷达 | 今日信息日报");
  lines.push("========================================");
  lines.push(`日期: ${latest.date}`);
  lines.push(`生成: ${fmtDate(latest.generatedAt)}`);
  lines.push("");
  lines.push("【今日摘要】");
  lines.push(summary);
  lines.push("");

  lines.push("── Top 5 重点推荐 ──");
  top5.forEach((r, i) => {
    lines.push(`${i + 1}. [${SOURCE_NAMES[r.source] ?? r.source}] ${r.title}`);
    lines.push(`   分数: ${r.score} | ${r.url}`);
    lines.push(`   标签: ${r.tags.slice(0, 4).join("、")}`);
    if (r.llmSummary) lines.push(`   摘要: ${r.llmSummary}`);
    if (r.llmRecommendationReason) lines.push(`   推荐理由: ${r.llmRecommendationReason}`);
    if (r.llmRiskNote) lines.push(`   风险提示: ${r.llmRiskNote}`);
    lines.push("");
  });

  lines.push("── 6-10 补充关注 ──");
  more5.forEach((r, i) => {
    const reason = or(r.llmRecommendationReason, r.llmSummary || r.summary);
    lines.push(`${i + 6}. [${SOURCE_NAMES[r.source] ?? r.source}] ${r.title} (${r.score}分)`);
    lines.push(`   ${reason}`);
    lines.push(`   ${r.url}`);
    lines.push("");
  });

  lines.push("【来源分布】");
  for (const [src, count] of Object.entries(dist)) {
    lines.push(`  ${SOURCE_NAMES[src] ?? src}: ${count} 条`);
  }
  lines.push("");

  lines.push("────────────────────────────────────");
  lines.push("本邮件由 agent雷达 MVP 自动生成");
  lines.push("数据来自公开来源（Hacker News、Dev.to、ArXiv）");
  lines.push("LLM 内容仅供参考，请以原文为准");
  lines.push("本系统不抓取、不存储、不发送任何私有数据");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// HTML render
// ---------------------------------------------------------------------------

function renderHtml(latest: Latest): string {
  const top5 = latest.topRecommendations.slice(0, 5);
  const more5 = latest.topRecommendations.slice(5, 10);
  const dist = sourceDist(latest.topRecommendations);
  const summary = or(latest.llmReport.summary, `今日共筛选出 ${latest.stats.recommendationCount} 条重点信息，覆盖 ${latest.sources.map((s) => SOURCE_NAMES[s] ?? s).join("、")}。`);

  const css = `
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#f7f7f8;margin:0;padding:0;color:#171717}
    .wrap{max-width:640px;margin:0 auto;padding:24px 16px}
    .hdr{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;border:1px solid #e5e7eb}
    .hdr h1{font-size:22px;margin:0 0 4px;font-weight:600}
    .hdr .date{color:#71717a;font-size:13px}
    .card{background:#fff;border-radius:16px;padding:20px 24px;margin-bottom:12px;border:1px solid #e5e7eb}
    .rank{display:inline-block;background:#eef0ff;color:#5e6ad2;border-radius:8px;width:26px;height:26px;text-align:center;line-height:26px;font-size:13px;font-weight:600;margin-right:8px}
    .title{font-size:16px;font-weight:600;line-height:1.4}
    .title a{color:#171717;text-decoration:none}
    .meta{font-size:12px;color:#71717a;margin:6px 0}
    .tags{margin:4px 0}
    .tag{display:inline-block;background:#f3f4f6;border-radius:99px;padding:2px 8px;font-size:11px;color:#52525b;margin:2px 4px 2px 0}
    .field-label{font-size:12px;color:#71717a;font-weight:600;margin-top:10px}
    .field-text{font-size:14px;color:#52525b;line-height:1.5}
    .risk{background:#fff7ed;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;margin-top:10px;font-size:13px;color:#92400e}
    .section-title{font-size:18px;font-weight:600;margin:24px 0 12px}
    .compact-item{background:#fff;border-radius:12px;padding:14px 18px;margin-bottom:8px;border:1px solid #e5e7eb;font-size:14px}
    .footer{text-align:center;color:#a1a1aa;font-size:11px;margin-top:32px;line-height:1.8}
    a{color:#5e6ad2;text-decoration:none}
  `;

  function recCard(r: Rec, i: number) {
    const rank = i < 3 ? `style="background:#5e6ad2;color:#fff"` : "";
    const title = `<span class="rank" ${rank}>${i + 1}</span><span class="title"><a href="${esc(r.url)}">${esc(r.title)}</a></span>`;
    const meta = `<span>${SOURCE_NAMES[r.source] ?? esc(r.source)}</span> &middot; <span>${r.score} 分</span> &middot; <span>${fmtDate(r.publishedAt)}</span>`;
    const tags = r.tags.slice(0, 6).map((t) => `<span class="tag">${esc(t)}</span>`).join("");

    let extra = "";
    if (r.llmSummary) extra += `<div class="field-label">摘要</div><div class="field-text">${esc(r.llmSummary)}</div>`;
    if (r.llmRecommendationReason) extra += `<div class="field-label">推荐理由</div><div class="field-text">${esc(r.llmRecommendationReason)}</div>`;
    if (r.llmRiskNote) extra += `<div class="risk">&#9888; ${esc(r.llmRiskNote)}</div>`;

    return `<div class="card"><div>${title}</div><div class="meta">${meta}</div><div class="tags">${tags}</div>${extra}</div>`;
  }

  function compactItem(r: Rec, i: number) {
    const reason = or(r.llmRecommendationReason, r.llmSummary || r.summary).slice(0, 120);
    return `<div class="compact-item">
      <strong>#${i + 6}</strong> <a href="${esc(r.url)}">${esc(r.title)}</a>
      <span style="color:#71717a;font-size:12px"> &middot; ${SOURCE_NAMES[r.source] ?? esc(r.source)} &middot; ${r.score}分</span>
      ${reason ? `<div style="color:#52525b;margin-top:4px;font-size:13px">${esc(reason)}</div>` : ""}
    </div>`;
  }

  const sourceDistHtml = Object.entries(dist)
    .map(([src, count]) => `<span class="tag">${SOURCE_NAMES[src] ?? src}: ${count}</span>`)
    .join(" ");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>agent雷达 | 今日信息日报</title>
<style>${css}</style></head>
<body>
<div class="wrap">

<div class="hdr">
  <h1>&#128752; agent雷达 | 今日信息日报</h1>
  <div class="date">${esc(latest.date)} &middot; 生成于 ${fmtDate(latest.generatedAt)}</div>
</div>

<div class="card">
  <div class="field-label">今日摘要</div>
  <div class="field-text">${esc(summary)}</div>
</div>

<div class="section-title">&#9733; Top 5 重点推荐</div>
${top5.map((r, i) => recCard(r, i)).join("\n")}

<div class="section-title">&#9734; 6-10 值得关注</div>
${more5.map((r, i) => recCard(r, i + 5)).join("\n")}

<div class="card" style="margin-top:16px">
  <div class="field-label">来源分布</div>
  <div style="margin-top:6px">${sourceDistHtml}</div>
</div>

<div class="footer">
  本邮件由 agent雷达 MVP 自动生成<br>
  数据来自公开来源（Hacker News、Dev.to、ArXiv）<br>
  LLM 内容仅供参考，请以原文为准<br>
  本系统不抓取、不存储、不发送任何私有数据
</div>

</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("[radar:email] Task 5A — generating email preview...");

  if (!fs.existsSync(LATEST_PATH)) {
    console.error(`[radar:email] ERROR: ${LATEST_PATH} not found. Run 'npm run radar:generate:latest' first.`);
    process.exit(1);
  }

  const latest: Latest = JSON.parse(fs.readFileSync(LATEST_PATH, "utf-8"));
  const top10 = latest.topRecommendations;
  if (!Array.isArray(top10) || top10.length === 0) {
    console.error("[radar:email] ERROR: topRecommendations empty or missing.");
    process.exit(1);
  }

  console.log(`[radar:email] Loaded ${top10.length} recommendations.`);
  const dist = sourceDist(top10);
  console.log(`[radar:email] Source dist: ${JSON.stringify(dist)}`);

  // Render
  const html = renderHtml(latest);
  const text = renderText(latest);

  // Write
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(HTML_PATH, html, "utf-8");
  fs.writeFileSync(TXT_PATH, text, "utf-8");

  console.log(`\n[radar:email] Done.`);
  console.log(`  HTML: ${HTML_PATH} (${html.length} bytes)`);
  console.log(`  TXT:  ${TXT_PATH} (${text.length} bytes)`);
  console.log(`  Top 10: ${top10.length} | Top 5: ${Math.min(5, top10.length)}`);
  console.log(`  No email was sent. No SMTP was called.`);
}

try {
  main();
} catch (err) {
  console.error("[radar:email] Fatal:", err);
  process.exit(1);
}
