# DESIGN.md

# 信息雷达 / 周报机器人 UI Design System

## 1. Product Direction

This project is an information radar and weekly report robot.

The UI should feel like a calm, reliable, high-signal productivity dashboard.

Design inspiration:

* Linear: clean dashboard, precise spacing, subtle borders, restrained colors, high-quality SaaS feel.
* Notion: readable content blocks, document-like information hierarchy, calm surfaces, clear lists.

The goal is not to copy any brand exactly. Use the design language as inspiration only.

The interface should help users quickly understand:

1. What was collected today.
2. Which 5 items are most worth reading.
3. Why they were recommended.
4. What sources and keywords are trending.
5. What the generated daily or weekly report looks like.

## 2. General Design Principles

### 2.1 Clarity First

Every page should answer:

* What is this page for?
* What should the user look at first?
* What is the most important recommendation?
* What can the user do next?

Avoid decorative UI that does not improve understanding.

### 2.2 High Signal, Low Noise

This product processes information overload. The UI itself must not create more noise.

Use:

* clear hierarchy
* calm backgrounds
* compact but readable cards
* meaningful tags
* precise spacing
* short labels
* restrained visual emphasis

Avoid:

* excessive gradients
* huge hero banners
* random bright colors
* heavy shadows
* overly large cards
* noisy illustrations
* unnecessary animations

### 2.3 Dashboard + Document Hybrid

The product should combine:

* dashboard clarity from Linear
* document readability from Notion

Use cards for metrics and recommendations.
Use document-style sections for reports, summaries, and explanations.

## 3. Visual Tone

Keywords:

* clean
* calm
* intelligent
* editorial
* precise
* trustworthy
* minimal
* high-quality
* focused
* productized

The UI should look like a serious AI productivity tool, not a toy demo.

## 4. Color System

### 4.1 Base Colors

Use a neutral, soft background.

Recommended CSS variables:

```css
:root {
  --bg-page: #f7f7f8;
  --bg-surface: #ffffff;
  --bg-subtle: #f3f4f6;
  --bg-muted: #eef0f3;

  --text-primary: #171717;
  --text-secondary: #52525b;
  --text-muted: #71717a;
  --text-faint: #a1a1aa;

  --border-subtle: #e5e7eb;
  --border-strong: #d4d4d8;

  --accent: #5e6ad2;
  --accent-hover: #4f46c7;
  --accent-soft: #eef0ff;

  --success: #16a34a;
  --success-soft: #ecfdf3;

  --warning: #d97706;
  --warning-soft: #fff7ed;

  --danger: #dc2626;
  --danger-soft: #fef2f2;

  --info: #2563eb;
  --info-soft: #eff6ff;
}
```

### 4.2 Usage Rules

Use neutral colors for most UI.

Use accent color only for:

* primary actions
* active filters
* selected states
* important score highlights
* meaningful links

Do not use many saturated colors at the same time.

### 4.3 Score Colors

Recommendation score should be visually clear but not too flashy.

Suggested score levels:

* 90-100: high confidence, accent or success style
* 75-89: recommended, accent soft style
* 60-74: useful, neutral style
* below 60: secondary / muted style

Do not use aggressive red unless something is actually wrong.

## 5. Typography

### 5.1 Font Stack

Use system fonts.

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Chinese fallback:

```css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "PingFang SC",
  "Microsoft YaHei",
  sans-serif;
```

### 5.2 Type Scale

Use restrained typography.

Recommended scale:

```css
--font-xs: 12px;
--font-sm: 13px;
--font-base: 14px;
--font-md: 15px;
--font-lg: 18px;
--font-xl: 22px;
--font-2xl: 28px;
```

### 5.3 Font Weight

Use medium weight sparingly.

* Page title: 600
* Section title: 600
* Card title: 560-600
* Body text: 400
* Secondary text: 400
* Label/tag: 500

Avoid too many bold elements.

### 5.4 Text Color

Use:

* primary text for titles and important values
* secondary text for descriptions
* muted text for metadata
* faint text for timestamps and low-priority hints

## 6. Layout

### 6.1 Page Container

Main content should be centered with a readable max width.

Recommended:

```css
.page {
  min-height: 100vh;
  background: var(--bg-page);
}

.page-container {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 24px 56px;
}
```

### 6.2 Responsive Layout

Desktop:

* dashboard metrics can use 3-4 columns
* Top 5 cards can use single-column list or 2-column layout
* report preview should be full width or right-side panel depending on page complexity

Tablet:

* reduce to 2 columns

Mobile:

* single column
* compact spacing
* avoid horizontal scrolling
* tables should become stacked cards if needed

### 6.3 Spacing

Use consistent spacing.

Recommended spacing scale:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

Avoid random margins.

## 7. Components

## 7.1 Cards

Cards are the main surface.

Recommended style:

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
```

Hover state:

```css
.card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}
```

Use hover only for clickable cards.

## 7.2 Recommendation Card

Each Top recommendation should show:

* rank
* title
* source
* score
* short summary
* reason
* tags
* original link

Preferred structure:

```text
#1  Project / Article Title              Score 92
Source · Published time · Tags

Short summary of what it is.

Why recommended:
This item is recommended because ...

[Open original]
```

Rules:

* The rank should be visible but not oversized.
* Score should be clear.
* Recommendation reason must be readable.
* External link should be obvious.

## 7.3 Metric Cards

Metric cards show overview numbers.

Examples:

* Fetched today
* After dedupe
* Top recommendations
* Sources
* Last generated

Metric cards should be compact.

Use:

* small label
* large value
* short helper text

## 7.4 Tags

Tags should be subtle.

```css
.tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  background: var(--bg-subtle);
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
}
```

Use accent tags only for selected filters or highly important states.

## 7.5 Buttons

Primary button:

```css
.button-primary {
  background: var(--accent);
  color: white;
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
}
```

Secondary button:

```css
.button-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 14px;
  font-weight: 500;
}
```

Buttons should not look oversized.

## 7.6 Tables and Lists

Use tables only when comparison matters.

For candidate lists, prefer a clean list layout:

* title
* source
* score
* tags
* timestamp
* link

On mobile, use stacked cards instead of wide tables.

## 7.7 Report Preview

The daily or weekly report should look like a readable document.

Use:

* white background
* clear headings
* comfortable line height
* subtle dividers
* markdown-like hierarchy

Recommended style:

```css
.report-preview {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 24px;
  line-height: 1.7;
}
```

## 8. Page Structure

## 8.1 Home Page

Recommended layout:

```text
Header
  Product name
  Short subtitle
  Last generated time

Overview
  Metric cards

Top 5 Recommendations
  Recommendation cards

Trend Keywords
  Tags or small keyword chart

All Candidates
  List or compact table

Report Preview
  Markdown-style daily report
```

## 8.2 Header

Header should be simple.

Example:

```text
信息雷达
每日自动抓取 AI / Agent / 开源项目信号，去重、评分，并生成 Top 推荐与周报。
```

Do not use exaggerated marketing copy.

## 8.3 Empty State

When no report exists:

```text
还没有生成今日报告
运行 pnpm radar:run 后，这里会展示最新推荐结果。
```

Empty state should include the next action.

## 8.4 Loading State

Use simple skeletons or quiet loading text.

Avoid flashy spinners.

## 8.5 Error State

Error messages should explain:

1. What failed.
2. What the user can try.
3. Whether partial data is still available.

Example:

```text
部分数据源抓取失败
GitHub API 暂时不可用，但 Hacker News 和 Dev.to 数据已成功加载。
```

## 9. Interaction Rules

### 9.1 Links

External links should open in a new tab.

Use clear labels:

* Open original
* View source
* Read more

### 9.2 Filters

Filters should be optional and simple.

Potential filters:

* Source
* Score range
* Tag
* Date
* Recommendation only

Do not overbuild filters in MVP.

### 9.3 Sorting

Default sort:

1. recommended items first
2. score descending
3. newest first

## 10. Content Style

The UI copy should be concise and product-like.

Prefer:

* 今日概览
* Top 推荐
* 推荐理由
* 数据来源
* 趋势关键词
* 全部候选
* 生成日报
* 查看原文

Avoid:

* 震惊
* 爆火
* 偷走
* 神器
* 全网最强
* 秒杀
* 黑科技

The product should sound reliable, not clickbait.

## 11. AI Recommendation Explanation

Recommendation reasons should be factual and structured.

Good example:

```text
该项目近期在 GitHub 获得较高关注，并且与 Agent 工作流和自动化工具强相关，适合作为本周开源项目观察对象。
```

Bad example:

```text
这个项目太强了，必须看，绝对是下一个爆款。
```

## 12. Do Not

Do not:

1. Copy brand logos.
2. Use Apple / Linear / Notion / Stripe names as product branding.
3. Recreate another company's website exactly.
4. Use many random colors.
5. Add heavy animations.
6. Add large decorative illustrations without purpose.
7. Change business logic when only asked to improve UI.
8. Mix multiple unrelated design systems.
9. Make every card look equally important.
10. Hide the recommendation reason.

## 13. Implementation Guidance for AI Coding Agents

When modifying UI:

1. Read this file before editing.
2. Keep the existing business logic unchanged unless explicitly requested.
3. Preserve existing data structure unless the task asks for data changes.
4. Improve layout, spacing, typography, states, responsiveness, and visual hierarchy.
5. Keep the visual system consistent across all pages.
6. Prefer reusable CSS classes or components.
7. After editing, run the available build command.
8. Report changed files and any remaining UI issues.

## 14. Default Design Decision

Unless the user explicitly asks to switch design style, all pages in this project should follow this design system.

Do not redesign the project from scratch each time.

Do not mix random brand styles.

Default style:

Linear + Notion inspired information dashboard.
