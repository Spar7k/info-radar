/**
 * Generate data/status.json — public-safe status file for dashboard display.
 * Contains NO keys, no passwords, no emails, no IPs, no domains.
 */

import fs from "node:fs";
import path from "node:path";

const LATEST_PATH = path.resolve("data", "latest.json");
const STATUS_PATH = path.resolve("data", "status.json");

function main(): void {
  console.log("[radar:status] Generating data/status.json...");

  // Read latest.json for pipeline stats
  let topRecs = 0;
  let candidateCount = 0;
  const sources: string[] = [];
  let hasLlm = false;

  if (fs.existsSync(LATEST_PATH)) {
    const latest = JSON.parse(fs.readFileSync(LATEST_PATH, "utf-8"));
    topRecs = latest.topRecommendations?.length ?? 0;
    candidateCount = latest.candidates?.length ?? 0;
    if (Array.isArray(latest.sources)) sources.push(...latest.sources);
    // Check if LLM was used
    const firstRec = latest.topRecommendations?.[0];
    hasLlm = !!(firstRec?.llmSummary || firstRec?.llmRecommendationReason);
  }

  const status = {
    generatedAt: new Date().toISOString(),
    llm: {
      status: hasLlm ? "connected" : "not_used",
      provider: "DeepSeek",
      model: "deepseek-v4-flash",
      description: hasLlm
        ? "已用于生成摘要、推荐理由、风险提示和日报"
        : "未在当前数据中使用（可能未配置 API Key）",
    },
    email: {
      status: "manual_verified",
      supported: true,
      mode: "manual",
      providers: ["qq", "netease163", "netease126", "neteaseyeah", "custom"],
      sendEnabledByDefault: false,
      description: "已支持本地脚本发送，前端真实发送需服务器 API",
    },
    automation: {
      status: "not_configured",
      description: "当前为手动生成和手动发送，自动化定时任务尚未接入",
    },
    pipeline: {
      fetchStatus: sources.length > 0 ? "ok" : "unknown",
      rankingStatus: topRecs > 0 ? "ok" : "unknown",
      topRecommendations: topRecs,
      candidateCount,
      sources,
    },
  };

  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2), "utf-8");
  console.log(`[radar:status] Wrote ${STATUS_PATH}`);
  console.log(`  LLM: ${status.llm.status} | Email: ${status.email.status} | Top recs: ${topRecs}`);
}

try {
  main();
} catch (err) {
  console.error("[radar:status] ERROR:", err);
  process.exit(1);
}
