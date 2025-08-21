import { StackTraceParser } from './stackTraceParser';

/**
 * Enhanced stack trace parser with browser-compatible HTML escaping
 */
class BrowserCompatibleStackTraceParser extends StackTraceParser {
  /**
   * Browser-compatible HTML escaping function
   */
  public static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format parsed stack trace as HTML (browser-compatible version)
   */
  public static formatAsHtml(parsedStackTrace: any): string {
    if (!parsedStackTrace.hasStackTrace) {
      return '<p class="no-stacktrace">No stack trace found</p>';
    }
    
    const lines = parsedStackTrace.lines.map((line: any) => {
      const indentSpaces = '&nbsp;'.repeat(line.indent);
      const escapedContent = this.escapeHtml(line.content.trim());
      
      let cssClass = `stacktrace-${line.type}`;
      
      switch (line.type) {
        case 'exception':
          return `<div class="${cssClass}">${indentSpaces}<span class="exception-text">${escapedContent}</span></div>`;
        case 'at':
          return `<div class="${cssClass}">${indentSpaces}<span class="at-keyword">at</span> <span class="method-name">${this.escapeHtml(line.className || '')}.${this.escapeHtml(line.methodName || '')}</span>(<span class="location">${this.escapeHtml(line.fileName || '')}${line.lineNumber ? ':' + line.lineNumber : ''}</span>)</div>`;
        case 'caused_by':
          return `<div class="${cssClass}">${indentSpaces}<span class="caused-by-keyword">Caused by:</span> <span class="exception-text">${this.escapeHtml(line.content.replace(/^\s*Caused by:\s*/, ''))}</span></div>`;
        case 'suppressed':
          return `<div class="${cssClass}">${indentSpaces}<span class="suppressed-keyword">Suppressed:</span> <span class="exception-text">${this.escapeHtml(line.content.replace(/^\s*Suppressed:\s*/, ''))}</span></div>`;
        case 'more':
          return `<div class="${cssClass}">${indentSpaces}<span class="more-text">${escapedContent}</span></div>`;
        default:
          return `<div class="${cssClass}">${indentSpaces}${escapedContent}</div>`;
      }
    });
    
    return `<div class="stacktrace-container">${lines.join('\n')}</div>`;
  }
}

/**
 * Get the HTML template for the frontend page
 */
function getHtmlTemplate(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Java Stack Trace Parser</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            background-color: #1e1e1e;
            color: #d4d4d4;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }
        
        .header {
            background-color: #2d2d30;
            padding: 1rem;
            border-bottom: 1px solid #3e3e42;
        }
        
        .header h1 {
            color: #ffffff;
            font-size: 1.5rem;
            font-weight: 600;
        }
        
        .header p {
            color: #cccccc;
            margin-top: 0.5rem;
            font-size: 0.9rem;
        }
        
        .container {
            display: flex;
            flex: 1;
            min-height: 0;
        }
        
        .panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
        }
        
        .panel-header {
            background-color: #2d2d30;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #3e3e42;
            font-weight: 600;
            color: #ffffff;
        }
        
        .left-panel {
            border-right: 1px solid #3e3e42;
        }
        
        .input-area {
            flex: 1;
            padding: 1rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .input-textarea {
            flex: 1;
            width: 100%;
            background-color: #1e1e1e;
            color: #d4d4d4;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            padding: 1rem;
            font-family: inherit;
            font-size: 14px;
            line-height: 1.5;
            resize: none;
            outline: none;
        }
        
        .input-textarea:focus {
            border-color: #007acc;
            box-shadow: 0 0 0 1px #007acc;
        }
        
        .button-group {
            display: flex;
            gap: 0.5rem;
        }
        
        .btn {
            padding: 0.5rem 1rem;
            border: 1px solid #3e3e42;
            border-radius: 4px;
            background-color: #0e639c;
            color: #ffffff;
            cursor: pointer;
            font-family: inherit;
            font-size: 14px;
            transition: background-color 0.2s;
        }
        
        .btn:hover {
            background-color: #1177bb;
        }
        
        .btn-secondary {
            background-color: #2d2d30;
        }
        
        .btn-secondary:hover {
            background-color: #3e3e42;
        }
        
        .output-area {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
            background-color: #0d1117;
        }
        
        .stacktrace-container {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.6;
            color: #e6edf3;
        }
        
        .stacktrace-exception {
            color: #ff6b6b;
            font-weight: 600;
            margin: 0.25rem 0;
        }
        
        .stacktrace-at {
            color: #8b949e;
            margin: 0.1rem 0;
        }
        
        .stacktrace-caused_by {
            color: #ffa657;
            font-weight: 600;
            margin: 0.5rem 0 0.25rem 0;
        }
        
        .stacktrace-suppressed {
            color: #f1e05a;
            font-weight: 600;
            margin: 0.25rem 0;
        }
        
        .stacktrace-more {
            color: #79c0ff;
            margin: 0.1rem 0;
        }
        
        .stacktrace-unknown {
            color: #8b949e;
            margin: 0.1rem 0;
        }
        
        .at-keyword {
            color: #79c0ff;
        }
        
        .method-name {
            color: #ffa657;
        }
        
        .location {
            color: #a5a5a5;
        }
        
        .exception-text {
            color: #ff6b6b;
        }
        
        .caused-by-keyword,
        .suppressed-keyword {
            color: #ffa657;
            font-weight: 600;
        }
        
        .more-text {
            color: #79c0ff;
            font-style: italic;
        }
        
        .no-stacktrace {
            color: #8b949e;
            font-style: italic;
            text-align: center;
            margin-top: 2rem;
        }
        
        .stats {
            background-color: #2d2d30;
            padding: 0.75rem 1rem;
            border-top: 1px solid #3e3e42;
            font-size: 12px;
            color: #8b949e;
        }
        
        .sample-button {
            margin-top: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Java Stack Trace Parser</h1>
        <p>输入包含 Java 堆栈跟踪的文本，自动提取并格式化显示</p>
    </div>
    
    <div class="container">
        <div class="panel left-panel">
            <div class="panel-header">输入文本</div>
            <div class="input-area">
                <textarea 
                    id="inputText" 
                    class="input-textarea" 
                    placeholder="在此粘贴包含 Java 堆栈跟踪的日志或文本..."
                ></textarea>
                <div class="button-group">
                    <button id="parseBtn" class="btn">解析堆栈跟踪</button>
                    <button id="clearBtn" class="btn btn-secondary">清空</button>
                    <button id="sampleBtn" class="btn btn-secondary sample-button">加载示例</button>
                    <button id="serializedSampleBtn" class="btn btn-secondary sample-button">JSON示例</button>
                </div>
            </div>
        </div>
        
        <div class="panel">
            <div class="panel-header">格式化输出</div>
            <div id="output" class="output-area">
                <p class="no-stacktrace">请在左侧输入包含堆栈跟踪的文本</p>
            </div>
            <div id="stats" class="stats">
                等待输入...
            </div>
        </div>
    </div>

    <script>
        const inputText = document.getElementById('inputText');
        const output = document.getElementById('output');
        const stats = document.getElementById('stats');
        const parseBtn = document.getElementById('parseBtn');
        const clearBtn = document.getElementById('clearBtn');
        const sampleBtn = document.getElementById('sampleBtn');
        const serializedSampleBtn = document.getElementById('serializedSampleBtn');
        
        const sampleStackTrace = '2024-08-21 10:30:45 [ERROR] Request processing failed\\n' +
            'java.lang.RuntimeException: Service unavailable\\n' +
            '\\tat com.example.service.UserService.getUser(UserService.java:45)\\n' +
            '\\tat com.example.controller.UserController.handleGetUser(UserController.java:25)\\n' +
            '\\tat com.example.framework.RequestHandler.handle(RequestHandler.java:100)\\n' +
            '\\t... 25 more\\n' +
            'Caused by: java.net.ConnectException: Connection refused\\n' +
            '\\tat java.base/java.net.Socket.connect(Socket.java:666)\\n' +
            '\\tat com.example.database.ConnectionPool.getConnection(ConnectionPool.java:89)\\n' +
            '\\t... 3 more\\n' +
            '\\tSuppressed: java.lang.IllegalStateException: Pool is shutting down\\n' +
            '\\t\\tat com.example.database.ConnectionPool.checkState(ConnectionPool.java:120)\\n' +
            '\\t\\tat com.example.database.ConnectionPool.getConnection(ConnectionPool.java:85)\\n' +
            '2024-08-21 10:30:46 [INFO] Retrying request...';

        const serializedSample = '{\\n' +
            '  "timestamp": "2024-08-21T10:30:45Z",\\n' +
            '  "level": "ERROR",\\n' +
            '  "message": "Service call failed",\\n' +
            '  "exception": "java.lang.RuntimeException: Service unavailable\\\\n\\\\tat com.example.service.UserService.getUser(UserService.java:45)\\\\n\\\\tat com.example.controller.UserController.handleGetUser(UserController.java:25)\\\\nCaused by: java.net.ConnectException: Connection refused\\\\n\\\\tat java.base/java.net.Socket.connect(Socket.java:666)\\\\n\\\\tSuppressed: java.lang.IllegalStateException: Pool is shutting down\\\\n\\\\t\\\\tat com.example.database.ConnectionPool.checkState(ConnectionPool.java:120)"\\n' +
            '}';

        async function parseStackTrace() {
            const input = inputText.value;
            if (!input.trim()) {
                output.innerHTML = '<p class="no-stacktrace">请输入文本</p>';
                stats.textContent = '等待输入...';
                return;
            }
            
            try {
                const response = await fetch('/api/parse', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text: input })
                });
                
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                
                const result = await response.json();
                
                if (result.success) {
                    output.innerHTML = result.formattedHtml;
                    const lineCount = result.parsedStackTrace.lines.length;
                    const hasStackTrace = result.parsedStackTrace.hasStackTrace;
                    stats.textContent = hasStackTrace 
                        ? '找到堆栈跟踪，共 ' + lineCount + ' 行'
                        : '未找到有效的堆栈跟踪';
                } else {
                    output.innerHTML = '<p class="no-stacktrace">解析失败: ' + (result.error || '未知错误') + '</p>';
                    stats.textContent = '解析失败';
                }
            } catch (error) {
                output.innerHTML = '<p class="no-stacktrace">请求失败: ' + error.message + '</p>';
                stats.textContent = '请求失败';
            }
        }
        
        function clearInput() {
            inputText.value = '';
            output.innerHTML = '<p class="no-stacktrace">请在左侧输入包含堆栈跟踪的文本</p>';
            stats.textContent = '等待输入...';
            inputText.focus();
        }
        
        function loadSample() {
            inputText.value = sampleStackTrace;
            parseStackTrace();
        }
        
        function loadSerializedSample() {
            inputText.value = serializedSample;
            parseStackTrace();
        }
        
        parseBtn.addEventListener('click', parseStackTrace);
        clearBtn.addEventListener('click', clearInput);
        sampleBtn.addEventListener('click', loadSample);
        serializedSampleBtn.addEventListener('click', loadSerializedSample);
        
        // Auto-parse on input change (debounced)
        let parseTimeout;
        inputText.addEventListener('input', () => {
            clearTimeout(parseTimeout);
            parseTimeout = setTimeout(parseStackTrace, 500);
        });
        
        // Handle keyboard shortcuts
        inputText.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                parseStackTrace();
            }
        });
    </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle API endpoints
    if (url.pathname === '/api/parse' && request.method === 'POST') {
      try {
        const { text } = await request.json() as { text: string };
        
        if (typeof text !== 'string') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid input: text field is required and must be a string'
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        // Extract stack trace
        const extractedStackTrace = StackTraceParser.extractStackTrace(text);
        
        // Parse stack trace
        const parsedStackTrace = StackTraceParser.parseStackTrace(extractedStackTrace);
        
        // Format as HTML
        const formattedHtml = BrowserCompatibleStackTraceParser.formatAsHtml(parsedStackTrace);
        
        return new Response(JSON.stringify({
          success: true,
          extractedStackTrace,
          parsedStackTrace,
          formattedHtml
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to parse request: ' + (error instanceof Error ? error.message : 'Unknown error')
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Handle health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Serve the HTML page for all other requests
    return new Response(getHtmlTemplate(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  },
};

// Type definitions for Cloudflare Workers
export interface Env {
  // Add any environment variables here
}
