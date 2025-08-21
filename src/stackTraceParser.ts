/**
 * Interface representing a parsed stack trace line
 */
export interface StackTraceLine {
  type: 'exception' | 'at' | 'caused_by' | 'suppressed' | 'more' | 'unknown';
  content: string;
  className?: string;
  methodName?: string;
  fileName?: string;
  lineNumber?: number;
  indent: number;
}

/**
 * Interface representing a complete parsed stack trace
 */
export interface ParsedStackTrace {
  lines: StackTraceLine[];
  hasStackTrace: boolean;
  extractedText: string;
}

/**
 * Extract and parse Java stack trace from a string
 */
export class StackTraceParser {
  private static readonly STACK_TRACE_PATTERNS = [
    // Exception line: Exception in thread "main" java.lang.NullPointerException: Cannot invoke...
    /^(\s*)(Exception in thread .+|[a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/,
    
    // At line: at com.example.Class.method(File.java:123)
    /^(\s*)at\s+([a-zA-Z_$][a-zA-Z0-9_$.]*\.[a-zA-Z_$][a-zA-Z0-9_$]*)\(([^)]+)\)\s*$/,
    
    // Caused by line: Caused by: java.lang.RuntimeException: Something went wrong
    /^(\s*)Caused by:\s*([a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/,
    
    // Suppressed line: Suppressed: java.lang.IOException: File not found
    /^(\s*)Suppressed:\s*([a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/,
    
    // More line: ... 15 more
    /^(\s*)\.\.\.\s*\d+\s*more\s*$/
  ];

  /**
   * Extract stack trace text from input string
   */
  public static extractStackTrace(input: string): string {
    // First, try to extract serialized stack trace from JSON fields
    const serializedStackTrace = this.extractSerializedStackTrace(input);
    if (serializedStackTrace) {
      return serializedStackTrace;
    }
    
    // Fallback to regular line-by-line extraction
    const lines = input.split(/\r?\n/);
    const stackTraceLines: string[] = [];
    let inStackTrace = false;
    let stackTraceStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Check if this line looks like a stack trace line
      const isStackTraceLine = this.isStackTraceLine(line);
      
      if (isStackTraceLine && !inStackTrace) {
        // Start of stack trace
        inStackTrace = true;
        stackTraceStartIndex = i;
        stackTraceLines.push(line);
      } else if (isStackTraceLine && inStackTrace) {
        // Continue stack trace
        stackTraceLines.push(line);
      } else if (inStackTrace && trimmedLine === '') {
        // Empty line in stack trace - might be end or continuation
        stackTraceLines.push(line);
      } else if (inStackTrace && !isStackTraceLine) {
        // Non-stack trace line found, might be end of stack trace
        // Look ahead to see if there are more stack trace lines
        let foundMoreStackTrace = false;
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          if (this.isStackTraceLine(lines[j])) {
            foundMoreStackTrace = true;
            break;
          }
        }
        
        if (!foundMoreStackTrace) {
          // End of stack trace
          break;
        } else {
          // Include this line and continue
          stackTraceLines.push(line);
        }
      }
    }
    
    return stackTraceLines.join('\n');
  }

  /**
   * Extract serialized stack trace from JSON strings
   */
  private static extractSerializedStackTrace(input: string): string | null {
    // Pattern to match quoted strings that contain stack trace patterns
    const quotedStringPattern = /"([^"\\]*(\\.[^"\\]*)*)"/g;
    let match;
    
    while ((match = quotedStringPattern.exec(input)) !== null) {
      const quotedContent = match[1];
      
      // Unescape the string content
      const unescapedContent = this.unescapeJsonString(quotedContent);
      
      // Check if this unescaped content contains stack trace patterns
      if (this.containsStackTracePatterns(unescapedContent)) {
        return unescapedContent;
      }
    }
    
    return null;
  }

  /**
   * Unescape JSON string content
   */
  private static unescapeJsonString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Check if content contains stack trace patterns
   */
  private static containsStackTracePatterns(content: string): boolean {
    const lines = content.split(/\r?\n/);
    let stackTraceLineCount = 0;
    
    for (const line of lines) {
      if (this.isStackTraceLine(line)) {
        stackTraceLineCount++;
        // If we find at least 2 stack trace lines, consider it a valid stack trace
        if (stackTraceLineCount >= 2) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if a line looks like a stack trace line
   */
  private static isStackTraceLine(line: string): boolean {
    const trimmed = line.trim();
    
    // Empty lines are not stack trace lines
    if (trimmed === '') {
      return false;
    }
    
    // Check against all patterns
    return this.STACK_TRACE_PATTERNS.some(pattern => pattern.test(line));
  }

  /**
   * Parse extracted stack trace text into structured format
   */
  public static parseStackTrace(stackTraceText: string): ParsedStackTrace {
    const lines = stackTraceText.split(/\r?\n/);
    const parsedLines: StackTraceLine[] = [];
    
    for (const line of lines) {
      if (line.trim() === '') {
        continue;
      }
      
      const parsedLine = this.parseStackTraceLine(line);
      if (parsedLine) {
        parsedLines.push(parsedLine);
      }
    }
    
    // Only consider it a valid stack trace if we have at least one recognized line type
    const hasValidStackTraceLines = parsedLines.some(line => 
      line.type !== 'unknown'
    );
    
    return {
      lines: parsedLines,
      hasStackTrace: hasValidStackTraceLines,
      extractedText: stackTraceText
    };
  }

  /**
   * Parse a single stack trace line
   */
  private static parseStackTraceLine(line: string): StackTraceLine | null {
    const indent = line.length - line.trimStart().length;
    
    // Exception line
    const exceptionMatch = line.match(/^(\s*)(Exception in thread .+|[a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/);
    if (exceptionMatch) {
      return {
        type: 'exception',
        content: line,
        indent
      };
    }
    
    // At line
    const atMatch = line.match(/^(\s*)at\s+([a-zA-Z_$][a-zA-Z0-9_$.]*\.[a-zA-Z_$][a-zA-Z0-9_$]*)\(([^)]+)\)\s*$/);
    if (atMatch) {
      const fullMethod = atMatch[2];
      const location = atMatch[3];
      
      // Extract class and method
      const lastDotIndex = fullMethod.lastIndexOf('.');
      const className = lastDotIndex > 0 ? fullMethod.substring(0, lastDotIndex) : '';
      const methodName = lastDotIndex > 0 ? fullMethod.substring(lastDotIndex + 1) : fullMethod;
      
      // Extract file name and line number
      let fileName: string | undefined;
      let lineNumber: number | undefined;
      
      const locationMatch = location.match(/^(.+):(\d+)$/);
      if (locationMatch) {
        fileName = locationMatch[1];
        lineNumber = parseInt(locationMatch[2]);
      } else {
        fileName = location;
      }
      
      return {
        type: 'at',
        content: line,
        className,
        methodName,
        fileName,
        lineNumber,
        indent
      };
    }
    
    // Caused by line
    const causedByMatch = line.match(/^(\s*)Caused by:\s*([a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/);
    if (causedByMatch) {
      return {
        type: 'caused_by',
        content: line,
        indent
      };
    }
    
    // Suppressed line
    const suppressedMatch = line.match(/^(\s*)Suppressed:\s*([a-zA-Z_$][a-zA-Z0-9_$.]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error)(?::\s*.+)?)\s*$/);
    if (suppressedMatch) {
      return {
        type: 'suppressed',
        content: line,
        indent
      };
    }
    
    // More line
    const moreMatch = line.match(/^(\s*)\.\.\.\s*\d+\s*more\s*$/);
    if (moreMatch) {
      return {
        type: 'more',
        content: line,
        indent
      };
    }
    
    // Unknown line
    return {
      type: 'unknown',
      content: line,
      indent
    };
  }

  /**
   * Format parsed stack trace as HTML
   */
  public static formatAsHtml(parsedStackTrace: ParsedStackTrace): string {
    if (!parsedStackTrace.hasStackTrace) {
      return '<p class="no-stacktrace">No stack trace found</p>';
    }
    
    const lines = parsedStackTrace.lines.map(line => {
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

  /**
   * Escape HTML special characters
   */
  protected static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
