# 自有服务器部署指南

## 构建

```bash
npm run site:build
npm run site:check
```

输出目录 `dist/` 包含：

```
dist/
├── dashboard.html
└── data/
    └── latest.json
```

## 上传到服务器

**scp**：

```bash
scp -r dist/* user@your-server-ip:/var/www/agent-radar/
```

**rsync**（增量同步）：

```bash
rsync -av --delete dist/ user@your-server-ip:/var/www/agent-radar/
```

## Nginx 配置

参考示例文件：[deploy/nginx/agent-radar.conf.example](deploy/nginx/agent-radar.conf.example)

关键步骤：

```bash
# 复制配置
sudo cp deploy/nginx/agent-radar.conf.example /etc/nginx/sites-available/agent-radar

# 编辑域名和路径
sudo nano /etc/nginx/sites-available/agent-radar

# 启用站点
sudo ln -s /etc/nginx/sites-available/agent-radar /etc/nginx/sites-enabled/

# 检查配置
sudo nginx -t

# 重载
sudo systemctl reload nginx
```

## HTTPS（可选）

```bash
sudo certbot --nginx -d your-domain.com
```

## 部署目录应有文件

```
/var/www/agent-radar/
├── dashboard.html
└── data/
    └── latest.json
```

**不应包含**：

- `src/`、`node_modules/`
- `.env`、`.env.*`
- `data/raw/`、`data/generated/`
- `_reference/`、`agents-radar/`

`npm run site:check` 可以验证这些规则。

## 每日自动化链路

每天两次定时任务，均使用北京时间（Asia/Shanghai）：

| 时间 | 任务 | 命令 |
|------|------|------|
| 07:30 | 刷新数据 | `npm run radar:daily:refresh` |
| 08:00 | 发送邮件 | `npm run radar:email:scheduled` |

**07:30 刷新数据**执行：fetch → generate → llm preview → llm apply → status → site:build

**08:00 发送邮件**读取已生成的最新日报并发送。

部署示例：
- [deploy/cron/agent-radar-daily-refresh.example](deploy/cron/agent-radar-daily-refresh.example)
- [deploy/systemd/agent-radar-refresh.timer.example](deploy/systemd/agent-radar-refresh.timer.example)

> 服务器系统时区必须为 Asia/Shanghai：`sudo timedatectl set-timezone Asia/Shanghai`

## 后续更新

本地重新生成数据后同步：

```bash
npm run radar:daily:refresh
rsync -av --delete dist/ user@your-server-ip:/var/www/agent-radar/
```

## 定时邮件推送

每天 08:00（北京时间 / Asia/Shanghai）自动发送日报邮件。

### 前置条件

1. 通过前端或 API 保存设置：
   ```
   POST /api/email/settings { "to": "you@example.com", "dailyEnabled": true }
   ```

2. 服务器环境变量：
   ```
   INFO_RADAR_EMAIL_SEND_ENABLED=true
   INFO_RADAR_EMAIL_PROVIDER=qq
   INFO_RADAR_SMTP_USER=...
   INFO_RADAR_SMTP_PASS=...
   INFO_RADAR_EMAIL_FROM=...
   ```

3. 服务器时区设置为北京时间：
   ```bash
   sudo timedatectl set-timezone Asia/Shanghai
   ```

### Dry-run 测试

```bash
INFO_RADAR_SCHEDULED_EMAIL_DRY_RUN=true npm run radar:email:scheduled
```

### 方式一：cron

参考 [deploy/cron/agent-radar-email.example](deploy/cron/agent-radar-email.example)

### 方式二：systemd timer

参考 [deploy/systemd/agent-radar-email.timer.example](deploy/systemd/agent-radar-email.timer.example)

> 前端"每天 08:00 自动推送"开关只保存设置到 `data/server/email_settings.json`。真正定时发送由服务器 cron 或 systemd timer 触发。

## 访问

- `http://your-domain.com/dashboard.html`
- 或 `http://your-server-ip/dashboard.html`
