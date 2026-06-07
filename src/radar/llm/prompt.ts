/**
 * LLM prompt builder — compact prompt with tight output constraints
 * to avoid JSON truncation.
 */

export interface LlmPromptItem {
  id: string;
  title: string;
  source: string;
  url: string;
  summary: string;
  tags: string[];
  score: number;
  scoreBreakdown: Record<string, number>;
  metrics: Record<string, unknown>;
  publishedAt: string | null;
}

/** Full enrichment prompt used on first attempt. */
export function buildEnrichmentPrompt(
  items: LlmPromptItem[],
  dateStr: string,
  sourceSummary: string,
): string {
  const itemsBlock = items
    .map((item, i) => {
      const bd = item.scoreBreakdown;
      const scoreDetail = `相关${bd.relevance ?? 0} 实用${bd.practicality ?? 0} 热度${bd.popularity ?? 0}`;
      return [
        `[${i + 1}] id: ${item.id}`,
        `标题: ${item.title}`,
        `来源: ${item.source} | 分数: ${item.score} (${scoreDetail})`,
        `链接: ${item.url}`,
        `标签: ${(item.tags ?? []).slice(0, 6).join(", ")}`,
        `摘要: ${(item.summary ?? "").slice(0, 300)}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `你是信息分析编辑。基于以下 Top 10 推荐生成简洁 JSON 简报。日期: ${dateStr}。${sourceSummary}。

${itemsBlock}

返回严格 JSON（不要代码块，不要解释）：
{
  "items": [
    {
      "id": "与输入完全一致的 id",
      "llmSummary": "一句话总结，40字以内",
      "llmRecommendationReason": "关注理由，60字以内",
      "llmRiskNote": "风险或局限，60字以内。无风险写'暂无特别风险提示'"
    }
  ],
  "report": {
    "summary": "今日摘要，80-120字",
    "markdown": "日报 Markdown，300-500字。段落：## 今日概览 / ## 精选 Top 5 / ## 其余值得关注 / ## 趋势判断 / ## 后续关注"
  }
}

规则: items长度=${items.length}，id必须一一对应。不编造。中文输出，产品文案风格。`;
}

/** Lighter prompt for retry — no markdown, items only. */
export function buildRetryPrompt(
  items: LlmPromptItem[],
  dateStr: string,
): string {
  const itemsBlock = items
    .map((item, i) => {
      return [
        `[${i + 1}] id: ${item.id}`,
        `标题: ${item.title}`,
        `来源: ${item.source} | 分数: ${item.score}`,
        `标签: ${(item.tags ?? []).slice(0, 4).join(", ")}`,
        `摘要: ${(item.summary ?? "").slice(0, 200)}`,
      ].join("\n");
    })
    .join("\n\n");

  return `你是信息分析编辑。基于以下 Top 10 推荐生成简洁 JSON。日期: ${dateStr}。

${itemsBlock}

返回严格 JSON（不要代码块，不要解释）：
{
  "items": [
    {
      "id": "与输入完全一致的 id",
      "llmSummary": "一句话总结，40字以内",
      "llmRecommendationReason": "关注理由，60字以内",
      "llmRiskNote": "风险，60字以内"
    }
  ],
  "report": {
    "summary": "今日摘要，80-120字"
  }
}

规则: items长度=${items.length}，id一一对应。不编造。中文。`;
}
