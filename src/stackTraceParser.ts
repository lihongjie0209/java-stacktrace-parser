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
   * Extract serialized stack trace from JSON strings or any text containing escaped stacktraces
   */
  private static extractSerializedStackTrace(input: string): string | null {
    // Try multiple extraction strategies in order of preference
    
    // Strategy 1: Look for complete quoted JSON strings
    const completeQuotedResult = this.extractFromQuotedStrings(input);
    if (completeQuotedResult) {
      return completeQuotedResult;
    }
    
    // Strategy 2: Look for incomplete JSON or partial strings with escaped content
    const incompleteJsonResult = this.extractFromIncompleteJson(input);
    if (incompleteJsonResult) {
      return incompleteJsonResult;
    }
    
    // Strategy 3: Look for raw escaped sequences in any text
    const rawEscapedResult = this.extractFromRawEscapedText(input);
    if (rawEscapedResult) {
      return rawEscapedResult;
    }
    
    return null;
  }

  /**
   * Extract from properly quoted JSON strings
   */
  private static extractFromQuotedStrings(input: string): string | null {
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
   * Extract from incomplete JSON or partial strings
   */
  private static extractFromIncompleteJson(input: string): string | null {
    // Look for patterns that might be incomplete JSON with escaped stacktraces
    // This handles cases like: "exception": "java.lang.Exception\\n\\tat...
    // or even without proper closing quotes
    
    const incompletePatterns = [
      // JSON field with escaped content (may be incomplete)
      /"[^"]*":\s*"([^"\\]*(?:\\.[^"\\]*)*)/g,
      // Just escaped content after a colon (incomplete JSON)
      /:\s*"([^"\\]*(?:\\.[^"\\]*)*)/g,
      // Content that looks like escaped stacktrace anywhere
      /"([^"\\]*(?:\\.[^"\\]*)*(?:Exception|Error)[^"\\]*(?:\\.[^"\\]*)*)/g
    ];
    
    for (const pattern of incompletePatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const content = match[1];
        const unescapedContent = this.unescapeJsonString(content);
        
        if (this.containsStackTracePatterns(unescapedContent)) {
          return unescapedContent;
        }
      }
      // Reset lastIndex for next pattern
      pattern.lastIndex = 0;
    }
    
    return null;
  }

  /**
   * Extract from raw escaped text sequences
   */
  private static extractFromRawEscapedText(input: string): string | null {
    // Look for escaped sequences that might be stacktraces even without JSON structure
    // This handles cases where stacktraces are embedded in logs or other text formats
    // Be more conservative to avoid false positives
    
    const escapedPatterns = [
      // Any text containing \\n and Exception/Error patterns with at least one \\t
      /([^"]*(?:Exception|Error)[^"]*\\n[^"]*\\t[^"]*at\s+[a-zA-Z_$][^"]*)/g,
      // Text with multiple \\n, \\t and java package patterns
      /([^"]*(?:java\.|com\.|org\.)[^"]*\\n[^"]*\\t[^"]*at\s+[^"]*(?:\\n[^"]*){1,})/g
    ];
    
    for (const pattern of escapedPatterns) {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        const content = match[1];
        
        // Only process if it looks sufficiently like an escaped stacktrace
        if (content.includes('\\n') && content.includes('\\t') && content.includes('at ')) {
          // Try to find the longest meaningful escaped sequence
          const extendedContent = this.extractExtendedEscapedSequence(input, match.index);
          const unescapedContent = this.unescapeJsonString(extendedContent);
          
          if (this.containsStackTracePatterns(unescapedContent)) {
            return unescapedContent;
          }
        }
      }
      // Reset lastIndex for next pattern
      pattern.lastIndex = 0;
    }
    
    return null;
  }

  /**
   * Extract extended escaped sequence from a starting position
   */
  private static extractExtendedEscapedSequence(input: string, startIndex: number): string {
    // Look backwards and forwards from the match to find the complete escaped sequence
    let start = startIndex;
    let end = startIndex;
    
    // Find the start of the escaped sequence (look for opening quote or whitespace)
    while (start > 0 && 
           input[start - 1] !== '"' && 
           input[start - 1] !== ' ' && 
           input[start - 1] !== '\t' && 
           input[start - 1] !== '\n') {
      start--;
    }
    
    // Find the end of the escaped sequence
    let escapeCount = 0;
    let inEscape = false;
    
    for (let i = startIndex; i < input.length; i++) {
      const char = input[i];
      
      if (char === '\\' && !inEscape) {
        inEscape = true;
        escapeCount++;
      } else if (inEscape) {
        inEscape = false;
        if (char === 'n' || char === 't' || char === 'r') {
          // Continue, this looks like an escape sequence
        } else if (char === '"' || char === '\\') {
          // Continue, this is an escaped quote or backslash
        } else {
          // Not a typical escape sequence, but continue for now
        }
      } else if (char === '"' && escapeCount > 0) {
        // Might be the end of the escaped sequence
        end = i;
        break;
      } else if (char === ' ' || char === '\t' || char === '\n') {
        // Whitespace might indicate end
        if (escapeCount >= 2) { // Only if we found some escapes
          end = i;
          break;
        }
      }
      
      if (i > startIndex + 2000) { // Prevent infinite loops
        break;
      }
    }
    
    if (end <= startIndex) {
      end = Math.min(input.length, startIndex + 1000); // Default to reasonable length
    }
    
    return input.substring(start, end);
  }

  /**
   * Unescape JSON string content with enhanced support for various escape sequences
   */
  private static unescapeJsonString(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  /**
   * Check if content contains stack trace patterns with enhanced detection
   */
  private static containsStackTracePatterns(content: string): boolean {
    const lines = content.split(/\r?\n/);
    let stackTraceLineCount = 0;
    let hasExceptionLine = false;
    let hasAtLine = false;
    
    for (const line of lines) {
      if (this.isStackTraceLine(line)) {
        stackTraceLineCount++;
        
        // Track different types of stack trace elements
        const trimmed = line.trim();
        if (trimmed.match(/(?:Exception|Error)(?::\s*|$)/) || 
            trimmed.match(/^Exception in thread/)) {
          hasExceptionLine = true;
        }
        if (trimmed.match(/^\s*at\s+[a-zA-Z_$]/)) {
          hasAtLine = true;
        }
      }
    }
    
    // More sophisticated validation:
    // - At least 2 stack trace lines, OR
    // - At least 1 exception line and 1 at line, OR  
    // - At least 3 lines that look like stack trace elements
    return stackTraceLineCount >= 2 || 
           (hasExceptionLine && hasAtLine) ||
           stackTraceLineCount >= 3;
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
