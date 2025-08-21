# Java Stack Trace Parser

[![Deploy to Cloudflare Workers](https://github.com/lihongjie0209/java-stacktrace-parser/actions/workflows/deploy.yml/badge.svg)](https://github.com/lihongjie0209/java-stacktrace-parser/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个基于 Cloudflare Workers 的 Java 堆栈跟踪解析工具，支持从文本和 JSON 字段中提取、解析和格式化 Java 异常堆栈跟踪。

## 🌟 在线演示

- **生产环境**: https://java-stacktrace-parser-prod.your-account.workers.dev
- **测试环境**: https://java-stacktrace-parser-staging.your-account.workers.dev

## 功能特性

- ✅ **智能提取**: 从混合文本中自动识别和提取 Java 堆栈跟踪
- ✅ **序列化支持**: 支持解析 JSON 字段中序列化的堆栈跟踪（使用 `\n` 连接的字符串）
- ✅ **完整解析**: 支持异常、Caused by、Suppressed 等完整的堆栈跟踪结构
- ✅ **语法高亮**: 提供美观的语法高亮显示
- ✅ **响应式界面**: 两栏布局，左侧输入，右侧格式化输出
- ✅ **实时解析**: 输入时自动解析（防抖处理）
- ✅ **示例数据**: 内置常规和 JSON 序列化的示例数据

## 支持的堆栈跟踪格式

### 1. 常规格式
```
java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
	at com.example.MyClass.myMethod(MyClass.java:25)
	at com.example.Main.main(Main.java:10)
```

### 2. 带 Caused by 的格式
```
java.lang.RuntimeException: Database connection failed
	at com.example.DatabaseService.connect(DatabaseService.java:45)
Caused by: java.sql.SQLException: Connection timeout
	at com.mysql.cj.jdbc.ConnectionImpl.connect(ConnectionImpl.java:123)
```

### 3. 带 Suppressed 的格式
```
java.lang.Exception: Main exception
	at com.example.Test.method(Test.java:10)
	Suppressed: java.lang.RuntimeException: Suppressed exception
		at com.example.Test.cleanup(Test.java:20)
```

### 4. JSON 序列化格式
```json
{
  "error": "java.lang.NullPointerException: Cannot invoke \"String.length()\" because \"str\" is null\n\tat com.example.MyClass.myMethod(MyClass.java:25)\n\tat com.example.Main.main(Main.java:10)"
}
```

## API 接口

### POST /api/parse
解析堆栈跟踪接口

**请求体:**
```json
{
  "text": "包含堆栈跟踪的文本或 JSON 字符串"
}
```

**响应:**
```json
{
  "success": true,
  "extractedStackTrace": "提取的原始堆栈跟踪文本",
  "parsedStackTrace": {
    "hasStackTrace": true,
    "lines": [
      {
        "type": "exception",
        "content": "java.lang.NullPointerException: ...",
        "indent": 0
      },
      {
        "type": "at",
        "content": "\tat com.example.MyClass.myMethod(MyClass.java:25)",
        "className": "com.example.MyClass",
        "methodName": "myMethod",
        "fileName": "MyClass.java",
        "lineNumber": 25,
        "indent": 1
      }
    ]
  },
  "formattedHtml": "格式化的 HTML 输出"
}
```

### GET /health
健康检查接口

## 开发

### 环境要求
- Node.js 18+
- npm

### 安装依赖
```bash
npm install
```

### 运行测试
```bash
npm test
```

### 本地开发
```bash
npm run dev
```
服务将在 http://127.0.0.1:8787 启动

### 构建
```bash
npm run build
```

### 部署
```bash
npm run deploy
```

## 🚀 CI/CD 流水线

项目使用 GitHub Actions 实现自动化 CI/CD：

### 工作流程
1. **测试阶段**: 运行单元测试和构建检查
2. **生产部署**: 推送到 `master` 分支自动部署到生产环境
3. **预览部署**: Pull Request 自动部署到测试环境

### GitHub Secrets 配置
要启用自动部署，需要在 GitHub 仓库中配置以下 secrets：

- `CLOUDFLARE_API_TOKEN`: Cloudflare API Token
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID

详细配置说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📊 监控和日志

- **GitHub Actions**: 查看部署流水线状态
- **Cloudflare Dashboard**: 监控应用性能和日志
- **健康检查**: `GET /health` 接口

## 项目结构

```
cfw-stack/
├── src/
│   ├── index.ts              # Cloudflare Worker 主入口
│   └── stackTraceParser.ts   # 堆栈跟踪解析核心逻辑
├── test/
│   └── stackTraceParser.test.ts  # 单元测试
├── package.json
├── tsconfig.json
├── wrangler.toml            # Cloudflare Workers 配置
└── vitest.config.ts         # 测试配置
```

## 核心解析逻辑

### 1. 智能提取
- 优先检测 JSON 字段中的序列化堆栈跟踪
- 使用正则表达式匹配引号包裹的字符串
- 自动转义 `\n`、`\t`、`\\` 等转义字符
- 验证提取内容是否包含有效的堆栈跟踪模式

### 2. 逐行解析
支持以下类型的行：
- `exception`: 异常行（如 `java.lang.NullPointerException: ...`）
- `at`: 方法调用行（如 `at com.example.Class.method(File.java:123)`）
- `caused_by`: 原因行（如 `Caused by: java.sql.SQLException: ...`）
- `suppressed`: 抑制异常行（如 `Suppressed: java.io.IOException: ...`）
- `more`: 省略行（如 `... 15 more`）

### 3. 语法高亮
使用 CSS 类为不同类型的行提供语法高亮：
- 异常名称和消息：红色
- 方法名：橙色
- 文件位置：灰色
- 关键字（at、Caused by 等）：蓝色

## 测试覆盖

项目包含 20 个单元测试，覆盖：
- ✅ 基本堆栈跟踪提取
- ✅ 复杂堆栈跟踪（Caused by、Suppressed）
- ✅ JSON 序列化堆栈跟踪提取
- ✅ 混合内容处理
- ✅ 边界情况处理
- ✅ 逐行解析准确性
- ✅ HTML 格式化输出

## 许可证

MIT License
