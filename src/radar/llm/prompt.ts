/**
 * LLM prompt builder — constructs a compact prompt from the Top 10 items
 * and the expected JSON output structure.
 */

// ---------------------------------------------------------------------------
// Item data sent to LLM (compact subset)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildEnrichmentPrompt(
  items: LlmPromptItem[],
  dateStr: string,
  sourceSummary: string,
): string {
  const itemsBlock = items
    .map((item, i) => {
      const bd = item.scoreBreakdown;
      const scoreDetail = `相关性${bd.relevance ?? 0} 实用性${bd.practicality ?? 0} 热度${bd.popularity ?? 0} 新鲜度${bd.freshness ?? 0}`;
      return [
        `[${i + 1}] id: ${item.id}`,
        `标题: ${item.title}`,
        `来源: ${item.source} | 分数: ${item.score} (${scoreDetail})`,
        `链接: ${item.url}`,
        `时间: ${item.publishedAt ?? "未知"}`,
        `标签: ${(item.tags ?? []).join(", ")}`,
        `摘要: ${(item.summary ?? "").slice(0, 600)}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `你是一位专业的信息分析编辑，负责为技术开发者生成简洁、可读的信息简报。

## 今日数据概况

日期: ${dateStr}
${sourceSummary}

## 今日 Top 10 推荐

${itemsBlock}

## 任务

请基于以上数据返回一个严格 JSON 对象（不要 Markdown 代码块，不要额外解释）：

{
  "items": [
    {
      "id": "与输入完全一致的 id",
      "llmSummary": "一句话中文总结，60 字以内",
      "llmRecommendationReason": "为什么值得开发者关注，80 字以内",
      "llmRiskNote": "需要注意的风险或局限，80 字以内。如果没有特别风险，写'暂无特别风险提示'"
    }
  ],
  "report": {
    "summary": "今日信息雷达中文摘要，150-250 字，概括今日重点方向和信号",
    "markdown": "一份中文日报 Markdown。包含以下段落：## 今日概览 / ## 今日精选 Top 5 / ## 另外 5 条值得关注 / ## 今日趋势判断 / ## 后续关注方向"
  }
}

## 重要规则

1. items 数组必须恰好包含 ${items.length} 个元素，id 必须与输入一一对应。
2. 不要编造标题、链接、分数或来源。
3. 不要说"已经验证""已经发布正式版""一定有效"等无法从数据判断的结论。
4. 风险提示要克制、客观。
5. 中文输出，语言像产品文案，不要像学术论文或模型思考过程。
6. report.markdown 要完整、可读，每个段落有实质内容，不要写占位符文字。`;
}
