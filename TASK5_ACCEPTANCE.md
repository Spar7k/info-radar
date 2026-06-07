# Task 5：邮件推送链路验收

> 日期：2026-06-07

## Task 5 完成范围

| 子任务 | 内容 | 状态 |
|--------|------|------|
| 5A | 邮件 HTML/TXT 预览生成 | ✅ |
| 5B | SMTP 配置读取 + dry-run | ✅ |
| 5C | 手动真实发送 + QQ/网易 provider preset | ✅ |
| 5D | 安全验收 + 文档收口 | ✅ |

## 当前邮件链路

```
data/latest.json
    │
    ├── templates.ts  ──→ renderEmailHtml() / renderEmailText()
    │
    ├── radar:email:preview  ──→ data/generated/email_preview.{html,txt}
    │
    ├── radar:email:dry-run  ──→ 验证配置 + data/generated/email_dry_run_summary.json
    │
    └── radar:email:send     ──→ 真实发送（需 INFO_RADAR_EMAIL_SEND_ENABLED=true）
```

## 支持的邮箱 Provider

| Provider | 邮箱 | Host | Port | Secure |
|----------|------|------|------|--------|
| `qq` | QQ 邮箱 | smtp.qq.com | 465 | true |
| `netease163` | 网易 163 | smtp.163.com | 465 | true |
| `netease126` | 网易 126 | smtp.126.com | 465 | true |
| `neteaseyeah` | 网易 yeah | smtp.yeah.net | 465 | true |
| `custom` | 自定义 | 手动指定 | 手动指定 | 手动指定 |

## 必要环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `INFO_RADAR_EMAIL_PROVIDER` | 否 | Provider preset（qq/netEase163/netEase126/netEaseYeah/custom） |
| `INFO_RADAR_SMTP_HOST` | custom 时 | SMTP 服务器地址（preset 时自动填充） |
| `INFO_RADAR_SMTP_PORT` | custom 时 | SMTP 端口（preset 时自动填充） |
| `INFO_RADAR_SMTP_SECURE` | 否 | 是否 TLS（preset 时自动填充） |
| `INFO_RADAR_SMTP_USER` | 是 | SMTP 登录用户名 |
| `INFO_RADAR_SMTP_PASS` | 是 | SMTP 密码或授权码 |
| `INFO_RADAR_EMAIL_FROM` | 是 | 发件人地址 |
| `INFO_RADAR_EMAIL_TO` | 是 | 收件人地址（多个用逗号分隔） |
| `INFO_RADAR_EMAIL_SEND_ENABLED` | 是 | 必须为 `true` 才允许真实发送 |

## 安全规则

| # | 规则 | 状态 |
|---|------|------|
| 1 | 默认不发送邮件 | ✅ |
| 2 | 必须显式设置 `INFO_RADAR_EMAIL_SEND_ENABLED=true` | ✅ |
| 3 | 缺少 SMTP 配置时拒绝发送 | ✅ |
| 4 | SMTP_PASS 不打印到控制台 | ✅（仅 `***configured***`） |
| 5 | SMTP_PASS 不写入任何生成文件 | ✅ |
| 6 | dry-run summary 不包含密码 | ✅（仅 boolean 标记） |
| 7 | `.env` / `.env.*` gitignored | ✅ |
| 8 | `data/generated/*` gitignored | ✅ |
| 9 | 必须使用授权码 / 应用专用密码 | ✅（README 中有说明） |
| 10 | dashboard.html 不读取 SMTP 配置 | ✅ |
| 11 | data/latest.json 不包含 SMTP 配置 | ✅ |

## 验收结果

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | `npm run typecheck` | ✅ 通过 |
| 2 | `npm run radar:email:preview` | ✅ email_preview.html + email_preview.txt 生成 |
| 3 | `npm run radar:email:dry-run` | ✅ dry_run_summary.json 生成，无密码 |
| 4 | send 未开启时拒绝 | ✅ 提示设置 ENABLED=true |
| 5 | send 缺配置时拒绝 | ✅ 列出 missingFields |
| 6 | QQ provider preset | ✅ smtp.qq.com:465, secure=true |
| 7 | NetEase163 provider preset | ✅ smtp.163.com:465, secure=true |
| 8 | 真实发送 | ✅ 已手动验证通过（详情不记录） |

## 当前边界

- 不做自动化（无 GitHub Actions）
- 不做定时任务
- 不做 Vercel 部署
- 不做群发
- 不做邮件模板自定义
- 不读取 .env 文件（仅用系统环境变量）

## 下一步建议

| Task | 内容 |
|------|------|
| 6A | GitHub Actions dry-run workflow |
| 6B | Vercel 静态站点部署 |
| 6C | 自动化生成 data/latest.json 并触发部署 |
| 6D | 可选邮件定时推送 |
