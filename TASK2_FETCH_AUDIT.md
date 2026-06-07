# Task 2A：真实抓取链路接入前的审计与方案设计

> 状态：审计完成，设计已定稿（2026-06-07 修订：Task 2/3/4 边界已收紧）
> 目标：为 Task 2B/2C/2D（真实抓取链路 clean-room 实现）做准备
> 约束：本任务未真正接入抓取，只做审计、数据契约固定和最小实现方案设计
>
> ## 任务边界总览
>
> | Task | 职责 | 输入 | 输出 |
> |------|------|------|------|
> | **Task 2** | 公开源抓取 + 字段标准化 | `sources.json` | `data/raw/YYYY-MM-DD.json` + `data/raw/latest_raw.json` |
> | **Task 3** | 去重 + 打分 + Top 10 + 写入正式 data/latest.json | `data/raw/latest_raw.json` | `data/latest.json` + `data/history/YYYY-MM-DD.json` |
> | **Task 4** | LLM 推荐理由 + LLM 日报 | `data/latest.json` | 覆盖写入 LLM 字段到 `data/latest.json` + `reports/*.md` |
> | **Task 5** | 邮箱推送 | `data/latest.json` | 邮件发送 |
> | **Task 6** | GitHub Actions + Vercel | 仓库 | 自动化 + 部署 |

---

## 一、当前 data/latest.json 字段契约

### 1.1 顶层字段（最终前端契约）

> 标注每个字段由哪个 Task 负责首次写入。Task 4 可以覆盖写入 LLM 字段。

| 字段 | 类型 | 必需 | 负责 Task | 说明 |
|------|------|------|-----------|------|
| `date` | `string` | ✅ | Task 3 | 日报日期，格式 `"YYYY-MM-DD"` |
| `generatedAt` | `string` (ISO 8601) | ✅ | Task 3 | 生成时间戳 |
| `stats` | `object` | ✅ | Task 3 | 统计摘要 |
| `stats.totalFetched` | `number` | ✅ | Task 2 | 原始抓取数（单源去重后的总数） |
| `stats.totalAfterDedupe` | `number` | ✅ | Task 3 | 跨源去重后数量 |
| `stats.totalScored` | `number` | ✅ | Task 3 | 参与评分的数量 |
| `stats.recommendationCount` | `number` | ✅ | Task 3 | 最终推荐数 (=10) |
| `sources` | `string[]` | ✅ | Task 2 | 本次成功抓取的源 ID 列表 |
| `keywords` | `string[]` | ✅ | Task 3 | 趋势关键词（从 Top 10 标签中提取，5-10 个） |
| `topRecommendations` | `array[10]` | ✅ | Task 3 | 精选推荐（前 5 全卡片 + 后 5 紧凑卡片） |
| `candidates` | `array` | ✅ | Task 3 | 全部候选（≥ 推荐数，按 score 降序） |
| `llmReport` | `object` | ✅ | Task 4→Task 3 fallback | LLM 日报（Task 4 未接入时由 Task 3 写入 fallback） |
| `email` | `object` | ✅ | Task 5 | 邮件推送状态（Task 3 初始化默认值，Task 5 更新） |

### 1.2 topRecommendations 每条 item 字段（最终前端契约）

| 字段 | 类型 | 必需 | 负责 Task | 说明 |
|------|------|------|-----------|------|
| `id` | `string` | ✅ | Task 2 | 唯一标识（如 `"hn-001"`） |
| `title` | `string` | ✅ | Task 2 | 标题 |
| `url` | `string` | ✅ | Task 2 | 原文链接 |
| `source` | `string` | ✅ | Task 2 | 来源 ID（github-trending / hn-top / devto-ai / arxiv-cs-cl / ...） |
| `publishedAt` | `string` (ISO 8601) | ✅ | Task 2 | 发布时间 |
| `summary` | `string` | ✅ | Task 2 | 简短摘要（原文或抓取所得，非 LLM 生成） |
| `tags` | `string[]` | ✅ | Task 2 | 标签列表（从 API 返回或提取） |
| `score` | `number` | ✅ | **Task 3** | 综合评分（0-100），由规则打分引擎计算 |
| `scoreBreakdown` | `object` | ✅ | **Task 3** | 评分明细 |
| `scoreBreakdown.relevance` | `number` | ✅ | Task 3 | 相关性（满分 30） |
| `scoreBreakdown.practicality` | `number` | ✅ | Task 3 | 实用性（满分 25） |
| `scoreBreakdown.popularity` | `number` | ✅ | Task 3 | 热门度（满分 20） |
| `scoreBreakdown.freshness` | `number` | ✅ | Task 3 | 新鲜度（满分 15） |
| `scoreBreakdown.sourceQuality` | `number` | ✅ | Task 3 | 来源质量（满分 10） |
| `scoreBreakdown.penalty` | `number` | ✅ | Task 3 | 扣分项（负数或 0） |
| `metrics` | `object` | ⚠️ | Task 2 | 原始指标（stars/points/reactions 等，结构随来源而异） |
| `ruleReasonHints` | `string[]` | ⚠️ | Task 3 | 规则评分命中理由（供 Task 4 LLM 参考） |
| `llmSummary` | `string` | ⚠️ | **Task 4** | LLM 生成摘要（Task 4 未接入时为 null） |
| `llmRecommendationReason` | `string` | ⚠️ | **Task 4** | LLM 推荐理由（Task 4 未接入时为 null） |
| `llmRiskNote` | `string` | ⚠️ | **Task 4** | LLM 风险提示（Task 4 未接入时为 null） |

> ✅ = dashboard.html 直接引用并渲染
> ⚠️ = 当前已使用但 Task 2/3 阶段可暂时为 null 或降级
> **加粗 Task** = 该字段不属于 Task 2 输出范围

### 1.3 candidates 每条 item 字段（最终前端契约）

| 字段 | 类型 | 必需 | 负责 Task |
|------|------|------|-----------|
| `id` | `string` | ✅ | Task 2 |
| `title` | `string` | ✅ | Task 2 |
| `url` | `string` | ✅ | Task 2 |
| `source` | `string` | ✅ | Task 2 |
| `publishedAt` | `string` (ISO 8601) | ✅ | Task 2 |
| `summary` | `string` | ✅ | Task 2 |
| `tags` | `string[]` | ✅ | Task 2 |
| `score` | `number` | ✅ | **Task 3** |

### 1.4 llmReport 字段

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `enabled` | `boolean` | ✅ | LLM 是否启用 |
| `provider` | `string` | ✅ | 当前使用的 provider |
| `model` | `string` | ✅ | 当前使用的 model |
| `status` | `string` | ✅ | 状态（`"ok"` / `"fallback"` / `"error"`） |
| `title` | `string` | ✅ | 日报标题 |
| `summary` | `string` | ✅ | 日报摘要（纯文本，markdown 缺失时的降级展示） |
| `markdown` | `string` | ⚠️ | 日报正文（Markdown，缺失时降级展示 summary） |

### 1.5 email 字段

| 字段 | 类型 | 必需 | 负责 Task | 说明 |
|------|------|------|-----------|------|
| `enabled` | `boolean` | ✅ | Task 3 初始化, Task 5 更新 | 邮件是否启用 |
| `status` | `string` | ✅ | Task 3 初始化, Task 5 更新 | 当前状态 |
| `lastSentAt` | `string` \| `null` | ✅ | Task 5 | 上次发送时间 |

### 1.6 RawRadarItem：Task 2 输出的原始 item 结构

> Task 2 只负责抓取和标准化。`RawRadarItem` 不包含 score、scoreBreakdown 或任何 LLM 字段。
> 这些字段由 Task 3（打分）和 Task 4（LLM）后续补充。

```typescript
interface RawRadarItem {
  id: string;                          // 唯一 ID（来源前缀 + 序号，如 "hn-001"）
  title: string;                       // 标题
  url: string;                         // 原文链接
  source: string;                      // 来源 ID（对应 sources.json 中的 id）
  sourceName: string;                  // 来源人类可读名称
  publishedAt: string;                 // ISO 8601 时间戳（缺失时用 fetchAt fallback）
  summary: string;                     // 简短摘要（原文/API 返回的描述，非 LLM 生成）
  tags: string[];                      // 标签列表（从 API 返回或提取）
  rawMetrics: Record<string, unknown>; // 原始指标（stars/points/reactions 等）
  fetchAt: string;                     // 抓取时间（ISO 8601）
}
```

**与最终 `topRecommendations` item 的区别**：

| 字段 | RawRadarItem (Task 2) | topRecommendations item (Task 3+4) |
|------|----------------------|-------------------------------------|
| `score` | 不存在 | Task 3 计算 |
| `scoreBreakdown` | 不存在 | Task 3 计算 |
| `metrics` | `rawMetrics`（原始） | Task 3 从 rawMetrics 提取后重命名 |
| `ruleReasonHints` | 不存在 | Task 3 生成 |
| `llmSummary` | 不存在 | Task 4 生成或 null |
| `llmRecommendationReason` | 不存在 | Task 4 生成或 null |
| `llmRiskNote` | 不存在 | Task 4 生成或 null |
| `sourceName` | ✅ 有 | ❌ 无（前端通过 SOURCE_LABELS 映射） |

---

## 二、dashboard.html 字段依赖明细

从 `dashboard.html` 的 `render()` 函数中提取的精确依赖：

### 2.1 顶层字段（render 函数解构）

```js
const { date, generatedAt, stats, keywords, topRecommendations, candidates, llmReport, email } = data;
```

| 解构变量 | 使用位置 | 用途 |
|----------|---------|------|
| `date` | Header（括号内展示） | 日期回显 |
| `generatedAt` | Header `formatDate(generatedAt)` | 显示生成时间 |
| `stats` | 4 张 Overview 卡片 | `stats.totalFetched`, `stats.totalAfterDedupe`, `stats.recommendationCount` |
| `data.sources` | 第 4 张 Overview 卡片 | `data.sources.length` 显示来源数 |
| `keywords` | 趋势关键词标签云 | 逐条渲染 `.tag.accent` |
| `topRecommendations` | Top 5 全卡片 + 6-10 紧凑卡片 | 见下方明细 |
| `candidates` | 全部候选表格 | 按 `score` 降序排序 |
| `llmReport` | 日报正文区域 | `title`, `summary`, `markdown` |
| `email` | Footer 附加提示 | `email.status === 'not_configured'` 时显示 |

### 2.2 topRecommendations 依赖（Top 5 + 6-10 合并）

**每条 item 直接引用的字段**：

| 字段 | Top 5 使用 | 6-10 使用 | 降级方式 |
|------|-----------|-----------|---------|
| `url` | 卡片点击 + 标题链接 + 查看原文 | 卡片点击 + 标题链接 + 查看原文 | 无降级（必填） |
| `title` | 标题 | 标题 | 无降级 |
| `source` | 来源标签 + CSS class | 来源标签 | `SOURCE_LABELS[rec.source] \|\| rec.source` |
| `score` | 分数显示 | 分数显示 | 直接输出数字 |
| `publishedAt` | 时间 | 时间 | `formatDate()` 处理 null |
| `tags` | 全量标签列表 | 前 3 个标签 | `(rec.tags \|\| [])` |
| `llmSummary` | 摘要区域 | 不展示 | `if (rec.llmSummary)` 条件渲染 |
| `llmRecommendationReason` | 推荐理由区域 | 紧凑理由 | `if` 条件渲染 |
| `scoreBreakdown` | 6 维度进度条 | 不展示 | `if (rec.scoreBreakdown)` 条件渲染 |
| `llmRiskNote` | 风险提示黄色卡片 | 不展示 | `if (rec.llmRiskNote)` 条件渲染 |

**结论**：当前前端对数据友好——所有 LLM 相关字段（`llmSummary`, `llmRecommendationReason`, `llmRiskNote`, `llmReport.markdown`）都是**条件渲染**，缺失时不会崩溃。

### 2.3 candidates 依赖

| 字段 | 使用 | 降级 |
|------|------|------|
| `url` | 标题链接 | 必填 |
| `title` | 表格列 | 必填 |
| `source` | 来源列 | `SOURCE_LABELS[c.source] \|\| c.source` |
| `score` | 排序 + 分数列 | `c.score \|\| 0` |
| `tags` | 前 3 个标签 | `(c.tags \|\| [])` |

### 2.4 前端兼容性总结（按 Task 边界）

**Task 2 结束后**（仅有 raw 数据，无 score 和 LLM 字段）：
- `data/latest.json` 尚未生成
- 前端 dashboard.html 不受影响（继续读取 mock 数据）

**Task 3 结束后**（完成打分和 latest.json 生成）：
- `data/latest.json` 首次由真实数据生成
- `score`, `scoreBreakdown` 已写入
- 以下 LLM 字段为 null 或 fallback 值，前端不会崩溃：

| 字段 | Task 3 fallback 值 | 前端行为 |
|------|-------------------|---------|
| `topRecommendations[i].llmSummary` | `null` | 整个"摘要"区域不渲染 |
| `topRecommendations[i].llmRecommendationReason` | `null` | 整个"推荐理由"区域不渲染 |
| `topRecommendations[i].llmRiskNote` | `null` | 黄色风险提示不渲染 |
| `llmReport.markdown` | simpleMarkdown（规则生成纯文本日报） | 正常渲染 |
| `llmReport.summary` | `"今日共抓取 N 条…"` | 正常渲染 |
| `topRecommendations[i].ruleReasonHints` | `[]` | 前端未直接引用此字段 |

---

## 三、当前项目结构审计

```
d:/agent radar/                     ← 项目根目录
├── .gitignore                       ← agents-radar/ 已排除
├── AGENTS.md                        ← Agent 设计指令
├── DESIGN.md                        ← UI 设计系统
├── dashboard.html                   ← 前端 Dashboard（纯 HTML）
├── data/
│   └── latest.json                  ← 当前为手写 mock 数据
├── agents-radar/                    ← 参考项目（gitignored，无许可证）
└── TASK2_FETCH_AUDIT.md             ← 本文件（新增）
```

**关键发现**：
- 项目根目录**没有** `src/`、`scripts/`、`package.json`、`tsconfig.json`
- 所有工具链（TypeScript、Vitest、tsx）都在 `agents-radar/` 中，但该项目无许可证，不能直接复制
- 新项目需要**从零建立自己的工程结构**

---

## 四、后续工程目录结构

### 4.1 Task 2 新增目录（抓取 + 标准化）

```
d:/agent radar/
├── sources.json                     ← [Task 2 新增] 数据源配置
├── scripts/
│   └── fetch.ts                     ← [Task 2 新增] 从 sources.json 读取配置并抓取 + 标准化
├── src/
│   └── types.ts                     ← [Task 2 新增] RawRadarItem + RadarItem 类型定义
├── data/
│   └── raw/
│       ├── YYYY-MM-DD.json          ← [Task 2 输出] 每日 raw 数据快照
│       └── latest_raw.json          ← [Task 2 输出] 最新 raw 数据（供 Task 3 读取）
├── package.json                     ← [Task 2 新增] 工程配置（tsx + typescript）
├── tsconfig.json                    ← [Task 2 新增] TypeScript 配置
├── dashboard.html                   ← [已有] 前端（不动）
├── data/
│   └── latest.json                  ← [已有] mock 数据（Task 2/3 阶段保留不动）
├── AGENTS.md                        ← [已有]
└── DESIGN.md                        ← [已有]
```

### 4.2 Task 3 新增目录（去重 + 打分 + 生成）

```
  ... (Task 2 结构保留)
├── scripts/
│   ├── fetch.ts                     ← [Task 2] 保留
│   ├── dedupe.ts                    ← [Task 3 新增] 跨源去重
│   ├── score.ts                     ← [Task 3 新增] 规则打分
│   └── generate.ts                  ← [Task 3 新增] 汇总输出 data/latest.json
├── data/
│   ├── raw/                         ← [Task 2] 保留
│   │   ├── YYYY-MM-DD.json
│   │   └── latest_raw.json
│   ├── latest.json                  ← [Task 3 覆写] 最终前端日报
│   └── history/
│       └── YYYY-MM-DD.json          ← [Task 3 新增] 历史快照
```

### 4.3 Task 4 新增目录（LLM）

```
  ...
├── reports/
│   └── YYYY-MM-DD.md               ← [Task 4 新增] LLM 日报 Markdown
```

**为什么不放 agents-radar/ 中**：
- `agents-radar/` 被 `.gitignore` 排除
- `agents-radar/` 无开源许可证，不能直接修改或依赖
- 新项目应有独立的工程根目录

---

## 五、抓取 + 处理管线设计

### 5.1 Task 2 管线（抓取 + 标准化 → raw 数据落盘）

```
sources.json          →  fetch.ts       →  data/raw/latest_raw.json
  (数据源配置)          (并发抓取+标准化)     + data/raw/YYYY-MM-DD.json
                                              (标准化后的 RawRadarItem[])
```

**管线细节**：
1. 读取 `sources.json`，过滤 `enabled: true`
2. 对每个源并发 fetch（`Promise.allSettled`）
3. 根据 `type` 字段调用不同 parser（json_api / xml_api / html_scrape）
4. 每个 item 映射为 `RawRadarItem`（标准化字段）
5. 写入 `data/raw/YYYY-MM-DD.json`（每日快照）
6. 覆盖写入 `data/raw/latest_raw.json`（供 Task 3 读取）

**Task 2 不负责**：
- 跨源去重
- 规则打分
- Top 10 选取
- 生成 `data/latest.json`
- 任何 LLM 字段

### 5.2 Task 3 管线（去重 + 打分 + 生成 latest.json）

```
data/raw/latest_raw.json  →  dedupe.ts   →  score.ts   →  generate.ts  →  data/latest.json
  (RawRadarItem[])           (跨源去重)      (规则打分)     (排序+Top 10)    + data/history/YYYY-MM-DD.json
```

**管线细节**：
1. 读取 `data/raw/latest_raw.json`
2. 跨源去重（URL 精确 + title 模糊）
3. 对每条 item 执行规则打分 → `score` + `scoreBreakdown`
4. 按 score 降序排序
5. 提取 Top 10 → `topRecommendations`（前 5 全卡片 + 6-10 紧凑）
6. 全部 scored items → `candidates`
7. 提取关键词 → `keywords`
8. 生成 `llmReport` fallback（规则生成的纯文本日报，标注无 LLM）
9. 汇总所有字段 → 写入 `data/latest.json`
10. 写入 `data/history/YYYY-MM-DD.json` 快照

**Task 3 不负责**：
- 原始抓取（数据来自 Task 2 的 raw 输出）
- LLM 推荐理由或 LLM 日报（Task 4 负责）

### 5.2 sources.json 字段设计

```json
{
  "version": 1,
  "sources": [
    {
      "id": "hn-top",
      "name": "Hacker News — AI Stories",
      "type": "json_api",
      "url": "https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI&hitsPerPage=20&numericFilters=created_at_i>{{since}}",
      "method": "GET",
      "headers": { "User-Agent": "info-radar/1.0" },
      "category": "ai_news",
      "weight": 1.0,
      "enabled": true,
      "limit": 20
    },
    {
      "id": "devto-ai",
      "name": "Dev.to — AI Tag",
      "type": "json_api",
      "url": "https://dev.to/api/articles?tag=ai&per_page=15&top=1",
      "method": "GET",
      "headers": { "User-Agent": "info-radar/1.0" },
      "category": "engineering",
      "weight": 0.9,
      "enabled": true,
      "limit": 15
    },
    {
      "id": "arxiv-cs-cl",
      "name": "ArXiv — cs.CL Recent",
      "type": "xml_api",
      "url": "https://export.arxiv.org/api/query?search_query=cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=15",
      "method": "GET",
      "headers": { "User-Agent": "info-radar/1.0" },
      "category": "research",
      "weight": 0.8,
      "enabled": true,
      "limit": 15,
      "rateLimitMs": 3000
    },
    {
      "id": "github-trending",
      "name": "GitHub Trending Daily",
      "type": "html_scrape",
      "url": "https://github.com/trending?since=daily",
      "method": "GET",
      "headers": { "User-Agent": "Mozilla/5.0 (compatible; info-radar/1.0)" },
      "category": "open_source",
      "weight": 1.0,
      "enabled": true,
      "limit": 20,
      "scrapeRules": {
        "listItemSelector": "article.Box-row",
        "titleSelector": "h2 a",
        "descriptionSelector": "p",
        "starsSelector": ".mr-3 + a",
        "languageSelector": "[itemprop=programmingLanguage]"
      }
    }
  ]
}
```

**字段说明**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 唯一标识，用于日志和去重 |
| `name` | `string` | ✅ | 人类可读名称 |
| `type` | `enum` | ✅ | `"json_api"` \| `"xml_api"` \| `"html_scrape"` \| `"rss"` |
| `url` | `string` | ✅ | 抓取 URL（支持 `{{since}}` 时间戳占位符） |
| `method` | `enum` | ⚠️ | HTTP method，默认 GET |
| `headers` | `object` | ⚠️ | 自定义请求头 |
| `category` | `string` | ⚠️ | 分类（ai_news / engineering / research / open_source / general） |
| `weight` | `number` | ⚠️ | 来源权重（0.0-1.0），影响评分中的 sourceQuality，默认 1.0 |
| `enabled` | `bool` | ✅ | 是否启用此源 |
| `limit` | `number` | ⚠️ | 最多取多少条 |
| `rateLimitMs` | `number` | ⚠️ | 请求间隔（ms），如 ArXiv 要求 3s |
| `scrapeRules` | `object` | ⚠️ | 仅 `html_scrape` 类型需要，CSS selector 规则 |

### 5.3 RawRadarItem 类型（Task 2 输出）

> 完整定义见 §1.6。Task 2 的输出仅包含此结构中的字段。
> `score`, `scoreBreakdown`, `llmSummary`, `llmRecommendationReason`, `llmRiskNote` 均不在此类型中。

### 5.4 去重算法（Task 3 负责，MVP 版）

所有抓取结果统一转换为此结构：

```typescript
interface RadarItem {
  id: string;                    // 唯一 ID（来源前缀 + 序号，如 "hn-001"）
  title: string;                 // 标题
  url: string;                   // 原文链接
  source: string;                // 来源 ID（对应 sources.json 中的 id）
  sourceName: string;            // 来源名称
  publishedAt: string;           // ISO 8601 时间戳（缺失时用抓取时间 fallback）
  summary: string;               // 简短摘要（原文/API 返回的描述，非 LLM 生成）
  tags: string[];                // 标签列表（从 API 返回或从标题/描述提取）
  rawMetrics: Record<string, unknown>; // 原始指标（stars/points/reactions 等，来源相关）
  fetchAt: string;               // 抓取时间（ISO 8601）
}
```

### 5.4 去重算法（MVP 版）

两层去重：

1. **URL 精确去重**：`url` 完全相同时只保留第一条（按 score 或发布时间）
2. **Title 模糊去重**：`title` 归一化后（小写、去标点、去多余空格）的 Levenshtein 距离 < 3 视为重复，保留 score 较高的

```typescript
function dedupe(items: RadarItem[]): RadarItem[] {
  // Layer 1: exact URL
  const seen = new Map<string, RadarItem>();
  for (const item of items) {
    const existing = seen.get(item.url);
    if (!existing || item.publishedAt > existing.publishedAt) {
      seen.set(item.url, item);
    }
  }

  // Layer 2: fuzzy title
  const result: RadarItem[] = [];
  const seenTitles: string[] = [];
  for (const item of seen.values()) {
    const norm = item.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const isDup = seenTitles.some(t => levenshtein(norm, t) < 3);
    if (!isDup) {
      seenTitles.push(norm);
      result.push(item);
    }
  }
  return result;
}
```

### 5.5 规则打分引擎（Task 3 负责，MVP 版，不接 LLM）

```typescript
interface ScoreInput {
  item: RadarItem;
  now: Date;
}

function scoreItem(input: ScoreInput): ScoreBreakdown {
  const { item, now } = input;
  const hoursAgo = (now.getTime() - new Date(item.publishedAt).getTime()) / 3600000;

  // relevance: 标题 + 标签匹配关键词表 (默认 20 分起步，有匹配加分)
  const relevance = Math.min(30, 20 + (matchKeywords(item.title + ' ' + item.tags.join(' ')) ? 10 : 0));

  // practicality: 根据来源类型判断 (教程/工具类更高，纯新闻较低)
  const practicalityMap: Record<string, number> = {
    github: 22, hackernews: 15, devto: 20, arxiv: 12, rss: 16
  };
  const practicality = Math.min(25, practicalityMap[item.source] ?? 16);

  // popularity: 从 rawMetrics 中提取 (stars/points/reactions)
  const popularity = Math.min(20, normalizePopularity(item));

  // freshness: 24h 内满分, 72h 后很低
  const freshness = Math.min(15, hoursAgo < 24 ? 15 : hoursAgo < 48 ? 12 : hoursAgo < 72 ? 8 : 3);

  // sourceQuality: 来源权重 * 10
  const sourceQuality = Math.min(10, Math.round((item.source === 'arxiv' || item.source === 'github' ? 9 : 7)));

  // penalty: 无惩罚项（暂不接入）
  const penalty = 0;

  return { relevance, practicality, popularity, freshness, sourceQuality, penalty };
}

function totalScore(b: ScoreBreakdown): number {
  return b.relevance + b.practicality + b.popularity + b.freshness + b.sourceQuality + b.penalty;
}
```

### 5.6 生成 data/latest.json（Task 3 负责）

`generate.ts` 负责将 `scoreItem` 的结果 + 排序 + topN 选取 + llmReport fallback 合成为最终 JSON：

```
sorted = candidates.sort by score desc
top10   = sorted.slice(0, 10)
rest    = sorted.slice(10)

latest.json = {
  date, generatedAt,
  stats: { totalFetched, totalAfterDedupe, totalScored, recommendationCount: 10 },
  sources: [...],
  keywords: extractKeywords(top10),          // 从 top10 标签中取高频 top 8
  topRecommendations: top10 (with scoreBreakdown, llm fields = null),
  candidates: all sorted items,
  llmReport: fallbackReport(date, stats),    // status: "fallback", 无 LLM 内容
  email: { enabled: false, status: "not_configured", lastSentAt: null }
}
```

**LLM fallback 报告**：当 LLM 未接入时，生成简单纯文本日报，保证 `llmReport.markdown` 不为空但标注为"规则生成"：

```markdown
# 信息雷达日报｜YYYY-MM-DD

## 今日概览
今日共抓取 N 条信息，去重后保留 M 条，最终推荐 10 条。
当前为规则自动生成版本，后续升级将使用 LLM 生成完整分析和推荐理由。

## 今日精选 Top 5
（列出前 5 条推荐的基本信息）

## 另外 5 条值得关注
（列出 6-10 条）

## 说明
本日报由规则引擎自动生成，不含 LLM 分析内容。
```

---

## 六、Task 2B / 2C / 2D 拆分计划

> 以下步骤属于 Task 2 范围：只做抓取 + 标准化 → 写入 raw 数据。
> 去重、打分、Top 10、生成 data/latest.json 属于 Task 3。
> LLM 推荐理由和 LLM 日报属于 Task 4。

---

### Task 2B：JSON API 抓取最小闭环

**目标**：TypeScript 脚手架 + 3 个 JSON API 源（Hacker News, Dev.to, GitHub Trending HTML scrape）+ 输出 raw 数据。

#### Step 2B-1：初始化 TypeScript 工程

| 文件 | 操作 | 内容 |
|------|------|------|
| `package.json` | 新建 | `"type": "module"`, 依赖 `tsx` + `typescript` + `@types/node` |
| `tsconfig.json` | 新建 | target ES2022, module ESNext, moduleResolution bundler, noEmit |
| `src/types.ts` | 新建 | `RawRadarItem` 类型定义（见 §1.6） |
| `scripts/` | 新建目录 | 空 |

**验收标准**：
```bash
pnpm install          # 成功安装
pnpm typecheck        # 无错误
```

#### Step 2B-2：新增 sources.json

| 文件 | 操作 | 内容 |
|------|------|------|
| `sources.json` | 新建 | 至少 3 个源（见 §5.2 字段设计，包含 HN / Dev.to / GitHub Trending） |

**验收标准**：JSON 格式合法，每个源有 id/name/type/url/category/weight/enabled/limit

#### Step 2B-3：新增 Hacker News fetcher

| 文件 | 操作 | 内容 |
|------|------|------|
| `scripts/fetch.ts` | 新建（主入口） | 读取 `sources.json`，对 `enabled: true` 的源执行 fetch |
| 内部实现 | `fetchHn()` | 调用 Algolia HN Search API → 映射为 `RawRadarItem[]` |

**HN 标准化映射**：
- `id` = `"hn-" + objectID`
- `title` = `hit.title`
- `url` = `hit.url ?? hnUrl`
- `summary` = 简短描述（从 title/tags 推断）
- `tags` = 从 title 匹配 AI 关键词（ai/llm/agent/claude/openai/gpt/rag/ml）
- `rawMetrics` = `{ points, num_comments, author }`

**验收标准**：
```bash
pnpm fetch:hn         # 成功运行，打印抓取数量
# data/raw/YYYY-MM-DD.json 包含 HN items
```

#### Step 2B-4：新增 Dev.to fetcher

| 文件 | 操作 | 内容 |
|------|------|------|
| `scripts/fetch.ts` 内部 | 新增 `fetchDevto()` | 调用 Forem API `?tag=ai` → 映射为 `RawRadarItem[]` |

**Dev.to 标准化映射**：
- `id` = `"devto-" + article.id`
- `title` = `article.title`
- `url` = `article.url`
- `summary` = `article.description`
- `tags` = `article.tag_list`
- `rawMetrics` = `{ positive_reactions_count, comments_count, reading_time_minutes }`

#### Step 2B-5：新增 GitHub Trending fetcher

| 文件 | 操作 | 内容 |
|------|------|------|
| `scripts/fetch.ts` 内部 | 新增 `fetchGitHubTrending()` | fetch `github.com/trending` HTML → 正则提取 → 映射为 `RawRadarItem[]` |

**GitHub Trending 标准化映射**：
- `id` = `"gh-" + fullName.replace("/", "-")`
- `title` = `owner/repo`
- `url` = `https://github.com/${fullName}`
- `summary` = `description`
- `tags` = `[language]` + 从 description 提取 AI 关键词
- `rawMetrics` = `{ todayStars, totalStars, forks, language }`

#### Step 2B-6：统一 runFetchers() + 写入 raw 数据

| 文件 | 操作 | 内容 |
|------|------|------|
| `scripts/fetch.ts` | 完成主入口 | `runFetchers()` 读取 sources.json，并发执行所有 enabled fetcher，`Promise.allSettled` 容错 |
| `package.json` | 更新 | `"scripts": { "fetch": "tsx scripts/fetch.ts" }` |

**输出文件**：
- `data/raw/YYYY-MM-DD.json`（所有源的 RawRadarItem[] 合并）
- `data/raw/latest_raw.json`（同上，覆盖写入）

**验收标准**：
```bash
pnpm fetch            # 一次运行，至少 3 个源成功
# data/raw/2026-06-0X.json 存在且为合法 JSON
# data/raw/latest_raw.json 存在且为合法 JSON
# cat data/raw/latest_raw.json | jq 'length'  # ≥ 20 条
# 单个源失败（如 GitHub Trending 503）不中断整体
```

---

### Task 2C：ArXiv fetcher

**目标**：单独实现 ArXiv Atom/XML 解析，接入统一管线。

| 文件 | 操作 | 内容 |
|------|------|------|
| `sources.json` | 更新 | 新增 `arxiv-cs-cl` / `arxiv-cs-lg` / `arxiv-cs-ai` 配置 |
| `scripts/fetch.ts` 内部 | 新增 `fetchArxiv()` | fetch `export.arxiv.org/api/query` Atom XML → 轻量正则提取 → 映射为 `RawRadarItem[]` |

**ArXiv 特殊处理**：
- 3 个 category 之间有 3s 间隔（`rateLimitMs: 3000`）
- XML 解析使用轻量正则提取 `<entry>`, `<title>`, `<summary>`, `<author>/<name>`, `<published>`, `<category>`
- 不引入第三方 XML 解析库
- `publishedAt` 使用 `<published>` 字段，过滤 48h 内论文

**ArXiv 标准化映射**：
- `id` = `"arxiv-" + arxivId`
- `title` = 论文标题（去除多余空白）
- `url` = `http://arxiv.org/abs/${arxivId}`
- `summary` = abstract 前 300 字符
- `tags` = categories（如 `["cs.CL", "cs.AI"]`）
- `rawMetrics` = `{ authors: string[], categories: string[], updated }`

**验收标准**：
```bash
pnpm fetch            # ArXiv 与其他源一起运行
# latest_raw.json 包含 arxiv- 前缀的 items
# 3 个 category 并发受 rateLimitMs 控制
```

---

### Task 2D：Task 2 整体验收

**验收标准**：

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | `pnpm fetch` 可本地运行 | 命令行执行无错误 |
| 2 | 至少 3 个源（HN + Dev.to + GitHub Trending）成功 | 日志输出成功数 ≥ 3 |
| 3 | 抓取到 20-50 条真实数据 | `jq 'length' data/raw/latest_raw.json` |
| 4 | 单源失败不中断整体 | 手动禁用某个源或模拟网络错误 |
| 5 | `data/raw/YYYY-MM-DD.json` 和 `data/raw/latest_raw.json` 为合法 JSON | `jq` 解析通过 |
| 6 | 每条 item 符合 `RawRadarItem` 结构 | 检查 id/title/url/source/sourceName/publishedAt/summary/tags/rawMetrics/fetchAt 齐全 |
| 7 | `data/latest.json` 未修改 | 仍然是 Task 1 的 mock 数据 |
| 8 | `dashboard.html` 未修改 | git diff 无变更 |
| 9 | `agents-radar/` 内无任何修改 | git status agents-radar/ clean |
| 10 | TypeScript typecheck 通过 | `pnpm typecheck` 无错误 |

---

## 七、风险分析

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| **来源失效**：API 改版或下线 | 中 | 该源数据为空 | `Promise.allSettled` 容错；`sources.json` 中 `enabled: false` 快速关闭 |
| **反爬/限速**：GitHub Trending 可能限频 | 低 | 暂时获取不到数据 | 设置 User-Agent；GitHub Trending HTML 无需认证；ArXiv 要求 3s 间隔已处理 |
| **编码问题**：ArXiv XML 包含特殊字符 | 中 | 解析失败返回空 | `try/catch` 包裹每条解析；JSON API 源不受影响 |
| **发布时间缺失**：某些源不返回时间 | 中 | freshness 评分不准确 | fallback 使用 `fetchAt`（抓取时间）作为 `publishedAt` |
| **重复内容**：跨源相同内容 | 高 | 推荐列表中出现重复 | 两层去重（URL 精确 + title 模糊） |
| **抓取结果为空**：所有源都失败或返回空 | 低 | `data/raw/latest_raw.json` 为空，后续 Task 3 无法生成推荐 | `Promise.allSettled` 保证单个源失败不中断；至少需要一个源成功；前端 dashboard.html 在 latest.json 无数据时展示 empty state |
| **前端字段不兼容**：新增/缺少字段导致 JS 报错 | 低 | dashboard 白屏 | generate.ts 的 fallback 逻辑保证输出结构稳定；所有 LLM 字段在无 LLM 时设为 null |

---

## 八、数据源策略

### 8.1 第一版目标源

本项目第一版（Task 2）覆盖 4 个数据源，全部为公开、无认证的 endpoint：

| # | 源 | 类型 | Endpoint | 认证 |
|---|-----|------|----------|------|
| 1 | Hacker News | JSON API | `hn.algolia.com/api/v1/search_by_date` | 无 |
| 2 | Dev.to | JSON API | `dev.to/api/articles?tag=ai` | 无 |
| 3 | GitHub Trending | HTML scrape | `github.com/trending?since=daily` | 无 |
| 4 | ArXiv | Atom/XML API | `export.arxiv.org/api/query` | 无 |

### 8.2 ArXiv 是 Atom/XML，不是 RSS

ArXiv 使用 Atom Feed（`application/atom+xml`），这是 ArXiv 官方提供的唯一 API 格式。与通用 RSS 不同：
- Atom 是 IETF 标准（RFC 4287），比 RSS 1.0/2.0 字段更规范和可预测
- ArXiv API 有官方文档，字段稳定
- 处理方式：轻量正则提取，不引入第三方 XML 库

### 8.3 RSS 不进入第一版范围

| 维度 | JSON API + Atom（第一版） | 通用 RSS（不在第一版） |
|------|---------------------------|------------------------|
| **解析难度** | `JSON.parse()` 或固定格式 Atom | 需要兼容 RSS 1.0/2.0/Atom 多种格式 |
| **字段稳定性** | 每个源有明确文档 | 各站字段不一致，经常缺时间/作者/摘要 |
| **第一波源数量** | 3 个 API + 1 个 HTML scrape 已覆盖全场景 | 需要逐个找 RSS 地址并适配 |

RSS 源可在后续版本按需添加（如技术博客、产品更新公告等），`sources.json` 的 `type: "rss"` 已预留扩展点。

---

## 九、本任务交付总结

### 9.1 修改/新增文件

| 文件 | 操作 |
|------|------|
| [TASK2_FETCH_AUDIT.md](TASK2_FETCH_AUDIT.md) | **修订**（本文件，2026-06-07 修订：收紧 Task 2/3/4 边界） |

**没有修改**：`dashboard.html`、`data/latest.json`、`AGENTS.md`、`DESIGN.md`、`agents-radar/` 内任何文件。

### 9.2 当前 data/latest.json 字段契约（含 Task 归属）

详见 §1.1-1.6。核心要点：
- 顶层 14 个字段，每条标注了负责 Task（Task 2 / Task 3 / Task 4 / Task 5）
- `topRecommendations` 每条 17 个字段，其中 `id`/`title`/`url`/`source`/`publishedAt`/`summary`/`tags`/`rawMetrics` 来自 **Task 2 的 RawRadarItem**
- `score`/`scoreBreakdown`/`ruleReasonHints` 由 **Task 3** 生成
- `llmSummary`/`llmRecommendationReason`/`llmRiskNote` 由 **Task 4** 生成或为 null
- `llmReport.markdown`/`llmReport.summary` 由 **Task 4** 生成，Task 3 提供 fallback
- 前端对 LLM 字段全部使用条件渲染，缺失不会崩溃

### 9.3 Task 2B 是否可以开始

**可以开始。** 前提条件：
- 数据契约已固定（本文档 §1），Task 2/3/4 边界已明确（task-boundary 表格）
- RawRadarItem 类型已定义（§1.6），Task 2 输出范围已明确
- Task 2 管线设计已定稿（§5.1），只输出 raw 数据
- 目录结构已规划（§4.1），`data/raw/` 目录与 `data/latest.json` 分离
- 风险已识别并有缓解措施（§7）
- Task 2B/2C/2D 验收标准已明确（§6）

### 9.4 修订内容清单

| 修订位置 | 内容 |
|----------|------|
| 文档头部 | 新增 Task 2/3/4/5/6 边界总览表格 |
| §1.1 顶层字段表 | 新增"负责 Task"列 |
| §1.2 topRecommendations 字段表 | 新增"负责 Task"列，加粗标注非 Task 2 字段 |
| §1.3 candidates 字段表 | 新增"负责 Task"列 |
| §1.5 email 字段表 | 新增"负责 Task"列 |
| **§1.6 新增** | RawRadarItem 类型定义 + 与最终 item 的区别对照表 |
| §2.4 前端兼容性总结 | 按 Task 2/3/4 边界重新组织，区分"Task 2 结束"和"Task 3 结束"两阶段 |
| §4 目录结构 | 拆分为 §4.1 (Task 2) + §4.2 (Task 3) + §4.3 (Task 4)，明确 `data/raw/` 是 Task 2 输出 |
| §5.1 整体流程 | 拆分为 §5.1 (Task 2 管线) + §5.2 (Task 3 管线) |
| §5.3 标题 | 改为"RawRadarItem 类型（Task 2 输出）" |
| §5.4 标题 | 改为"去重算法（Task 3 负责，MVP 版）" |
| §5.5 标题 | 改为"规则打分引擎（Task 3 负责，MVP 版，不接 LLM）" |
| §5.6 标题 | 改为"生成 data/latest.json（Task 3 负责）" |
| **§6 完全重写** | 原 Step 1-8 → Task 2B/2C/2D，去重/打分/生成/latest.json 全部移除 |
| §8 重写 | 明确第一版 4 个源 + ArXiv Atom ≠ RSS + RSS 不进第一版 |
| §9 更新 | 新增修订清单 + 更新 Task 边界摘要 |

### 9.5 本任务未做的事情（明确边界）

- 未真正接入抓取逻辑
- 未创建 `scripts/` 目录或任何脚本文件
- 未修改 `dashboard.html`
- 未修改 `data/latest.json`
- 未新增 `package.json` / `tsconfig.json`
- 未修改 `agents-radar/` 内任何文件
- 未实现 LLM 调用
- 未实现邮件推送
- 未实现 GitHub Actions
- 未实现 Vercel 部署
