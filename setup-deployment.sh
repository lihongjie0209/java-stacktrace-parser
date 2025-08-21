#!/bin/bash

# Cloudflare Workers 部署设置脚本
# 这个脚本帮助你设置 GitHub Secrets 以启用自动部署

echo "🚀 Cloudflare Workers 部署设置指南"
echo "=================================="
echo ""

echo "📋 需要设置的 GitHub Secrets:"
echo ""
echo "1. CLOUDFLARE_API_TOKEN"
echo "   - 访问: https://dash.cloudflare.com/profile/api-tokens"
echo "   - 点击 'Create Token'"
echo "   - 选择 'Edit Cloudflare Workers' 模板"
echo "   - 配置权限并创建 token"
echo ""

echo "2. CLOUDFLARE_ACCOUNT_ID"
echo "   - 访问: https://dash.cloudflare.com/"
echo "   - 在右侧边栏找到 'Account ID'"
echo "   - 复制 Account ID"
echo ""

echo "🔧 在 GitHub 中设置 Secrets:"
echo "   1. 访问: https://github.com/lihongjie0209/java-stacktrace-parser/settings/secrets/actions"
echo "   2. 点击 'New repository secret'"
echo "   3. 添加上述两个 secrets"
echo ""

echo "✅ 设置完成后，推送到 master 分支将自动部署到 Cloudflare Workers"
echo ""

# 检查是否已安装 wrangler
if command -v wrangler &> /dev/null; then
    echo "🔧 Wrangler CLI 已安装"
    echo "当前版本: $(wrangler --version)"
else
    echo "⚠️  建议全局安装 Wrangler CLI:"
    echo "   npm install -g wrangler"
fi

echo ""
echo "🏗️  本地开发命令:"
echo "   npm run dev     # 启动开发服务器"
echo "   npm run build   # 构建项目"
echo "   npm test        # 运行测试"
echo ""
echo "🚀 部署命令:"
echo "   npm run deploy          # 部署到默认环境"
echo "   npm run deploy:prod     # 部署到生产环境"
echo "   npm run deploy:staging  # 部署到测试环境"
