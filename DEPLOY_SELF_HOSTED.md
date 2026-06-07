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

## 后续更新

本地重新生成数据后同步：

```bash
npm run radar:fetch
npm run radar:generate:latest
npm run radar:llm:preview
npm run radar:llm:apply
npm run site:build
npm run site:check
rsync -av --delete dist/ user@your-server-ip:/var/www/agent-radar/
```

## 访问

- `http://your-domain.com/dashboard.html`
- 或 `http://your-server-ip/dashboard.html`
