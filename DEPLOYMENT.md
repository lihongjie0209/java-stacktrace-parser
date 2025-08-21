# Cloudflare Workers 部署配置

## GitHub Secrets 设置

要启用自动部署到 Cloudflare Workers，你需要在 GitHub 仓库中设置以下 secrets：

### 1. CLOUDFLARE_API_TOKEN
1. 访问 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. 点击 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板
4. 配置权限：
   - Zone: Zone:Read, Zone:Zone:Read
   - Account: Cloudflare Workers:Edit
5. 选择你的账户和区域
6. 创建 token 并复制

### 2. CLOUDFLARE_ACCOUNT_ID
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在右侧边栏找到 "Account ID"
3. 复制 Account ID

### 在 GitHub 中设置 Secrets
1. 访问你的 GitHub 仓库：https://github.com/lihongjie0209/java-stacktrace-parser
2. 进入 Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 分别添加：
   - Name: `CLOUDFLARE_API_TOKEN`, Value: 你的 API Token
   - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: 你的 Account ID

## 部署流程

### 自动部署
- 推送到 `master` 或 `main` 分支会自动触发部署
- GitHub Actions 会运行测试，测试通过后自动部署到 Cloudflare Workers

### 手动部署
```bash
# 部署到默认环境
npm run deploy

# 部署到生产环境
npx wrangler deploy --env production

# 部署到测试环境
npx wrangler deploy --env staging
```

## 环境配置

### 开发环境
```bash
npm run dev
```
本地开发服务器：http://127.0.0.1:8787

### 生产环境
- 名称：`java-stacktrace-parser-prod`
- 通过 GitHub Actions 自动部署

### 测试环境
- 名称：`java-stacktrace-parser-staging`
- 手动部署：`npx wrangler deploy --env staging`

## 监控和日志

部署后，你可以在以下位置监控应用：

1. **Cloudflare Dashboard**: https://dash.cloudflare.com/
2. **Workers 控制台**: 查看部署状态、日志和指标
3. **GitHub Actions**: 查看部署流水线状态

## 自定义域名（可选）

如果你有自定义域名，可以在 wrangler.toml 中添加：

```toml
[[env.production.routes]]
pattern = "your-domain.com/*"
zone_name = "your-domain.com"
```
