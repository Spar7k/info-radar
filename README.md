# 信息雷达 / Info Radar

每日自动抓取 AI / Agent / 开源项目公开信息，规则评分筛选 Top 10，可选 LLM 生成摘要、推荐理由和日报，通过静态 HTML 页面展示。

## 当前数据源

| 来源 | 类型 | 认证 |
|------|------|------|
| Hacker News | Algolia Search API（JSON） | 无 |
| Dev.to | Forem API（JSON） | 无 |
| ArXiv | Atom/XML API | 无 |
| GitHub Trending | HTML 页面解析 | 无（当前网络环境可能不可达） |

## 本地安装

```bash
npm install
```

## 本地运行

### 完整流程（4 步）

```bash
# Step 1: 抓取真实数据 → data/raw/
npm run radar:fetch

# Step 2: 去重 + 规则评分 + Top 10 → data/latest.json
npm run radar:generate:latest

# Step 3: LLM 生成推荐理由和日报预览 → data/generated/latest_llm_preview.json
npm run radar:llm:preview

# Step 4: 应用 LLM 结果到正式数据 → data/latest.json
npm run radar:llm:apply

# Step 5: 启动本地服务器查看
python -m http.server 5173
# 打开 http://localhost:5173/dashboard.html
```

### 快捷命令

```bash
npm run typecheck              # TypeScript 类型检查
npm run radar:generate:preview # 只生成预览（不覆盖正式数据）
```

## LLM 配置（可选）

不配置 LLM 也能运行完整 pipeline，只是推荐理由和日报保持为空。

支持任何 OpenAI-compatible API（DeepSeek、OpenAI、Ollama 等）。

### Windows CMD

```cmd
set INFO_RADAR_LLM_API_KEY=your_key_here
set INFO_RADAR_LLM_BASE_URL=https://api.deepseek.com
set INFO_RADAR_LLM_MODEL=deepseek-v4-flash
set INFO_RADAR_LLM_MAX_TOKENS=4096
```

### macOS / Linux

```bash
export INFO_RADAR_LLM_API_KEY=your_key_here
export INFO_RADAR_LLM_BASE_URL=https://api.deepseek.com
export INFO_RADAR_LLM_MODEL=deepseek-v4-flash
export INFO_RADAR_LLM_MAX_TOKENS=4096
```

### LLM 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `INFO_RADAR_LLM_API_KEY` | 是 | — | API Key |
| `INFO_RADAR_LLM_BASE_URL` | 否 | `https://api.openai.com/v1` | API 地址 |
| `INFO_RADAR_LLM_MODEL` | 否 | `gpt-4o-mini` | 模型名 |
| `INFO_RADAR_LLM_MAX_TOKENS` | 否 | `4096` | 最大输出 token 数 |
| `INFO_RADAR_LLM_JSON_MODE` | 否 | `true` | 是否启用 JSON mode |

## 生成文件说明

| 路径 | 用途 | 是否提交 |
|------|------|---------|
| `data/latest.json` | 正式前端展示数据 | ✅ 可提交 |
| `dashboard.html` | 静态展示页 | ✅ |
| `data/raw/*.json` | 原始抓取结果 | ❌ gitignored |
| `data/generated/*.json` | 预览 / 备份 | ❌ gitignored |

## 安全说明

- API Key 不进入前端（dashboard.html 只读取 JSON 文件）
- API Key 不写入 data/latest.json
- API Key 不提交 git（`.env` 和 `.env.*` 已 gitignored）
- LLM 只在本地 `npm run radar:llm:preview` 阶段调用

## 项目结构

```
info-radar/
├── dashboard.html                  # 前端展示页
├── data/
│   ├── latest.json                 # 正式数据（前端读取）
│   ├── raw/                        # 原始抓取数据（gitignored）
│   └── generated/                  # 预览和备份（gitignored）
├── src/
│   └── radar/
│       ├── types.ts                # 核心类型定义
│       ├── run.ts                  # 抓取入口
│       ├── utils/http.ts           # HTTP fetch 工具
│       ├── fetchers/               # 数据源抓取
│       │   ├── hackernews.ts
│       │   ├── devto.ts
│       │   ├── githubTrending.ts
│       │   ├── arxiv.ts
│       │   └── index.ts
│       ├── processors/             # 去重 + 评分 + 生成
│       │   ├── dedupe.ts
│       │   ├── score.ts
│       │   ├── buildOutput.ts
│       │   ├── generateLatest.ts
│       │   └── generateLatestPreview.ts
│       └── llm/                    # LLM 增强
│           ├── client.ts
│           ├── prompt.ts
│           ├── types.ts
│           ├── enrichLatestPreview.ts
│           └── applyLatestPreview.ts
├── sources.json                    # 数据源配置（预留）
├── DESIGN.md                       # UI 设计规范
├── AGENTS.md                       # Agent 指令
└── _reference/                     # 参考项目（gitignored）
```

## 邮件（Task 5）

### 预览和 dry-run

```bash
npm run radar:email:preview    # 生成邮件 HTML/TXT 预览
npm run radar:email:dry-run    # SMTP 配置验证 + would-send 摘要（不发送）
```

### 真实发送（需显式开启）

```bash
npm run radar:email:send       # 真实发送一封测试邮件
```

> **默认不会发送邮件。** 必须设置 `INFO_RADAR_EMAIL_SEND_ENABLED=true` 才会真实发送。

### Provider 预设

| Provider | 邮箱 | SMTP Host | Port | Secure |
|----------|------|-----------|------|--------|
| `qq` | QQ 邮箱 | smtp.qq.com | 465 | true |
| `netease163` | 网易 163 | smtp.163.com | 465 | true |
| `netease126` | 网易 126 | smtp.126.com | 465 | true |
| `neteaseyeah` | 网易 yeah | smtp.yeah.net | 465 | true |
| `custom` / 不设 | 自定义 | 手动指定 SMTP_HOST/PORT/SECURE | — | — |

### QQ 邮箱配置示例

```cmd
set INFO_RADAR_EMAIL_PROVIDER=qq
set INFO_RADAR_SMTP_USER=your_qq_email@qq.com
set INFO_RADAR_SMTP_PASS=your_qq_authorization_code
set INFO_RADAR_EMAIL_FROM=your_qq_email@qq.com
set INFO_RADAR_EMAIL_TO=your_target_email@example.com
set INFO_RADAR_EMAIL_SEND_ENABLED=true
npm run radar:email:dry-run
npm run radar:email:send
```

> QQ 邮箱需使用**授权码**（不是 QQ 密码）。在 QQ 邮箱 → 设置 → 账户 → POP3/SMTP 服务中生成。

### 网易 163 配置示例

```cmd
set INFO_RADAR_EMAIL_PROVIDER=netease163
set INFO_RADAR_SMTP_USER=your_163_email@163.com
set INFO_RADAR_SMTP_PASS=your_netease_client_password
set INFO_RADAR_EMAIL_FROM=your_163_email@163.com
set INFO_RADAR_EMAIL_TO=your_target_email@example.com
set INFO_RADAR_EMAIL_SEND_ENABLED=true
npm run radar:email:dry-run
npm run radar:email:send
```

> 网易邮箱需使用**客户端授权密码**（不是网页登录密码）。在网易邮箱 → 设置 → POP3/SMTP/IMAP 中开启并获取。

### SMTP 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `INFO_RADAR_SMTP_HOST` | 是 | SMTP 服务器地址（如 `smtp.gmail.com`） |
| `INFO_RADAR_SMTP_PORT` | 是 | 端口（如 `587`） |
| `INFO_RADAR_SMTP_SECURE` | 否 | 是否使用 TLS（`true`/`false`，默认 false） |
| `INFO_RADAR_SMTP_USER` | 是 | SMTP 登录用户名 |
| `INFO_RADAR_SMTP_PASS` | 是 | SMTP 密码或授权码（建议使用应用专用密码） |
| `INFO_RADAR_EMAIL_FROM` | 是 | 发件人地址 |
| `INFO_RADAR_EMAIL_TO` | 是 | 收件人地址（多个用逗号分隔） |

> **重要**：密码/授权码不要提交到 git。使用 `.env` 文件（已 gitignored）或系统环境变量。

### 每天 08:00 定时推送

前端"每天早上 8 点自动推送"开关保存设置到 `data/server/email_settings.json`。真正定时发送由服务器 cron 或 systemd timer 触发，每天 **08:00（北京时间 / Asia/Shanghai）** 执行。

```bash
# Dry-run（验证设置，不发送）
INFO_RADAR_SCHEDULED_EMAIL_DRY_RUN=true npm run radar:email:scheduled

# 真实发送（由 cron/systemd 调用）
npm run radar:email:scheduled
```

### 每日自动化链路

每天两次定时任务（北京时间 / Asia/Shanghai）：

| 时间 | 命令 | 说明 |
|------|------|------|
| 07:30 | `npm run radar:daily:refresh` | 抓取 → 生成 → LLM → 构建 dist |
| 08:00 | `npm run radar:email:scheduled` | 发送日报邮件 |
| 08:30 | `INFO_RADAR_CLEANUP_APPLY=true npm run radar:cleanup` | 清理旧 raw/generated 文件 |

> 服务器系统时区必须设置为 Asia/Shanghai。无 LLM Key 时跳过 LLM 步骤，仍生成规则推荐版本。

### 数据保留与清理

| 数据 | 保留策略 |
|------|---------|
| `data/latest.json` / `data/status.json` | 覆盖更新，永久保留 |
| `data/server/email_settings.json` | 用户设置，永不清理 |
| `data/raw/*.json` | 保留最近 30 天（latest_raw.json 永久保留） |
| `data/generated/*` | 保留最近 14 天 |

```bash
npm run radar:cleanup                                    # dry-run（预览）
INFO_RADAR_CLEANUP_APPLY=true npm run radar:cleanup      # 真实清理
```

部署示例：[deploy/cron/](deploy/cron/) | [deploy/systemd/](deploy/systemd/) | [DEPLOY_SELF_HOSTED.md](DEPLOY_SELF_HOSTED.md)

## 静态站点构建

```bash
npm run site:build
```

输出 `dist/` 目录（仅包含前端展示文件）：

```
dist/
├── dashboard.html
└── data/
    └── latest.json
```

> `dist/` 只包含静态展示文件，不包含源码、密钥、raw/generated 数据。

## 本地联调（API + 前端）

**测试邮件按钮需要同源访问，推荐使用 Express 服务器**：

```bash
npm run site:build
npm run server:start
# 打开 http://localhost:3000/dashboard.html
```

> 不推荐用 `python -m http.server` 测试邮件按钮。Python 静态服务器只支持 GET/HEAD，POST `/api/email/send` 会返回 HTTP 501。`server:start` 同时托管 API 和静态文件，前端同源请求可正常到达 API。

纯静态预览（无需 API）：

```bash
cd dist && python -m http.server 5173
# 打开 http://localhost:5173/dashboard.html
```

## 自有服务器部署

本项目为纯静态站点，构建后上传到自有服务器的 Nginx 即可。

```bash
npm run site:build              # 生成 dist/
npm run site:check              # 验证 dist/ 完整性
rsync -av --delete dist/ user@server:/var/www/agent-radar/
```

详细部署指南：[DEPLOY_SELF_HOSTED.md](DEPLOY_SELF_HOSTED.md)

Nginx 配置示例：[deploy/nginx/agent-radar.conf.example](deploy/nginx/agent-radar.conf.example)

> 不包含任何密钥，不需要 API Key，不需要数据库。Vercel 也可作为可选方案（`npm run site:build` 输出的 `dist/` 即为部署目录）。

## 当前 MVP 边界

**已完成**：
- 4 个公开数据源抓取（HN / Dev.to / ArXiv / GitHub Trending）
- 规则去重 + 多维度评分 + Top 10 推荐
- LLM 生成推荐理由和日报（可选）
- 静态 Dashboard 展示

**未包含**：
- 用户登录
- 私有数据抓取
- 邮件推送（Task 5）
- GitHub Actions 自动化（Task 6）
- Vercel 部署（Task 6）

## 许可证

MIT
