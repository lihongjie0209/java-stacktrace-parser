import { describe, it, expect } from 'vitest';
import { StackTraceParser, StackTraceLine, ParsedStackTrace } from '../src/stackTraceParser';

describe('StackTraceParser', () => {
  describe('extractStackTrace', () => {
    it('should extract simple stack trace from mixed text', () => {
      const input = `
Some regular log message
java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
	at com.example.MyClass.myMethod(MyClass.java:25)
	at com.example.Main.main(Main.java:10)
Another log message after stack trace
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.NullPointerException');
      expect(result).toContain('at com.example.MyClass.myMethod');
      expect(result).toContain('at com.example.Main.main');
      expect(result).not.toContain('Some regular log message');
      expect(result).not.toContain('Another log message after');
    });

    it('should extract stack trace with caused by', () => {
      const input = `
java.lang.RuntimeException: Database connection failed
	at com.example.DatabaseService.connect(DatabaseService.java:45)
	at com.example.UserService.getUser(UserService.java:20)
Caused by: java.sql.SQLException: Connection timeout
	at com.mysql.cj.jdbc.ConnectionImpl.connect(ConnectionImpl.java:123)
	at com.example.DatabaseService.createConnection(DatabaseService.java:60)
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.RuntimeException');
      expect(result).toContain('Caused by: java.sql.SQLException');
      expect(result).toContain('at com.mysql.cj.jdbc.ConnectionImpl.connect');
    });

    it('should extract stack trace with suppressed exceptions', () => {
      const input = `
java.lang.Exception: Main exception
	at com.example.Test.method(Test.java:10)
	Suppressed: java.lang.RuntimeException: Suppressed exception 1
		at com.example.Test.cleanup(Test.java:20)
	Suppressed: java.io.IOException: Suppressed exception 2
		at com.example.Test.close(Test.java:30)
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.Exception: Main exception');
      expect(result).toContain('Suppressed: java.lang.RuntimeException');
      expect(result).toContain('Suppressed: java.io.IOException');
    });

    it('should handle ... more lines', () => {
      const input = `
java.lang.RuntimeException: Error occurred
	at com.example.A.methodA(A.java:10)
	at com.example.B.methodB(B.java:20)
	... 15 more
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.RuntimeException');
      expect(result).toContain('... 15 more');
    });

    it('should return empty string for non-stack trace input', () => {
      const input = `
Just some regular log messages
No stack trace here
Another message
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toBe('');
    });

    it('should handle exception in thread format', () => {
      const input = `
Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
	at com.example.Main.main(Main.java:5)
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('Exception in thread "main"');
      expect(result).toContain('at com.example.Main.main');
    });

    it('should extract serialized stack trace from JSON string', () => {
      const input = `{
  "error": "java.lang.NullPointerException: Cannot invoke \\"String.length()\\" because \\"str\\" is null\\n\\tat com.example.MyClass.myMethod(MyClass.java:25)\\n\\tat com.example.Main.main(Main.java:10)",
  "timestamp": "2024-08-21T10:30:45Z"
}`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.NullPointerException');
      expect(result).toContain('at com.example.MyClass.myMethod');
      expect(result).toContain('at com.example.Main.main');
      expect(result).not.toContain('\\n'); // Should be properly unescaped
    });

    it('should extract complex serialized stack trace with caused by', () => {
      const input = `{
  "stackTrace": "java.lang.RuntimeException: Database connection failed\\n\\tat com.example.DatabaseService.connect(DatabaseService.java:45)\\n\\tat com.example.UserService.getUser(UserService.java:20)\\nCaused by: java.sql.SQLException: Connection timeout\\n\\tat com.mysql.cj.jdbc.ConnectionImpl.connect(ConnectionImpl.java:123)\\n\\tat com.example.DatabaseService.createConnection(DatabaseService.java:60)"
}`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.RuntimeException');
      expect(result).toContain('Caused by: java.sql.SQLException');
      expect(result).toContain('at com.mysql.cj.jdbc.ConnectionImpl.connect');
    });

    it('should extract serialized stack trace with suppressed exceptions', () => {
      const input = `{"exception": "java.lang.Exception: Main exception\\n\\tat com.example.Test.method(Test.java:10)\\n\\tSuppressed: java.lang.RuntimeException: Suppressed exception 1\\n\\t\\tat com.example.Test.cleanup(Test.java:20)\\n\\tSuppressed: java.io.IOException: Suppressed exception 2\\n\\t\\tat com.example.Test.close(Test.java:30)"}`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.Exception: Main exception');
      expect(result).toContain('Suppressed: java.lang.RuntimeException');
      expect(result).toContain('Suppressed: java.io.IOException');
    });

    it('should handle mixed content with serialized stack trace', () => {
      const input = `
Some log message before
{
  "level": "ERROR",
  "message": "Request failed",
  "exception": "java.lang.NullPointerException: Cannot invoke \\"String.length()\\" because \\"str\\" is null\\n\\tat com.example.MyClass.myMethod(MyClass.java:25)\\n\\tat com.example.Main.main(Main.java:10)",
  "timestamp": "2024-08-21T10:30:45Z"
}
Some log message after
`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toContain('java.lang.NullPointerException');
      expect(result).toContain('at com.example.MyClass.myMethod');
      expect(result).not.toContain('Some log message');
    });

    it('should ignore non-stack trace quoted strings', () => {
      const input = `{
  "message": "This is just a regular message with no stack trace",
  "user": "john.doe@example.com",
  "data": "Some other data that happens to have dots.like.this"
}`;
      
      const result = StackTraceParser.extractStackTrace(input);
      expect(result).toBe('');
    });
  });

  describe('parseStackTrace', () => {
    it('should parse simple stack trace correctly', () => {
      const stackTrace = `java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
	at com.example.MyClass.myMethod(MyClass.java:25)
	at com.example.Main.main(Main.java:10)`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      expect(result.lines).toHaveLength(3);
      
      const exceptionLine = result.lines[0];
      expect(exceptionLine.type).toBe('exception');
      expect(exceptionLine.content).toContain('java.lang.NullPointerException');
      
      const atLine1 = result.lines[1];
      expect(atLine1.type).toBe('at');
      expect(atLine1.className).toBe('com.example.MyClass');
      expect(atLine1.methodName).toBe('myMethod');
      expect(atLine1.fileName).toBe('MyClass.java');
      expect(atLine1.lineNumber).toBe(25);
      expect(atLine1.indent).toBeGreaterThan(0);
      
      const atLine2 = result.lines[2];
      expect(atLine2.type).toBe('at');
      expect(atLine2.className).toBe('com.example.Main');
      expect(atLine2.methodName).toBe('main');
      expect(atLine2.fileName).toBe('Main.java');
      expect(atLine2.lineNumber).toBe(10);
    });

    it('should parse caused by lines correctly', () => {
      const stackTrace = `java.lang.RuntimeException: Database connection failed
	at com.example.DatabaseService.connect(DatabaseService.java:45)
Caused by: java.sql.SQLException: Connection timeout
	at com.mysql.cj.jdbc.ConnectionImpl.connect(ConnectionImpl.java:123)`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      expect(result.lines).toHaveLength(4);
      
      const causedByLine = result.lines[2];
      expect(causedByLine.type).toBe('caused_by');
      expect(causedByLine.content).toContain('Caused by: java.sql.SQLException');
    });

    it('should parse suppressed lines correctly', () => {
      const stackTrace = `java.lang.Exception: Main exception
	at com.example.Test.method(Test.java:10)
	Suppressed: java.lang.RuntimeException: Suppressed exception
		at com.example.Test.cleanup(Test.java:20)`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      const suppressedLine = result.lines.find(line => line.type === 'suppressed');
      expect(suppressedLine).toBeDefined();
      expect(suppressedLine!.content).toContain('Suppressed: java.lang.RuntimeException');
    });

    it('should parse more lines correctly', () => {
      const stackTrace = `java.lang.RuntimeException: Error occurred
	at com.example.A.methodA(A.java:10)
	... 15 more`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      const moreLine = result.lines.find(line => line.type === 'more');
      expect(moreLine).toBeDefined();
      expect(moreLine!.content).toContain('... 15 more');
    });

    it('should handle exception in thread format', () => {
      const stackTrace = `Exception in thread "main" java.lang.NullPointerException: Cannot invoke "String.length()" because "str" is null
	at com.example.Main.main(Main.java:5)`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      expect(result.lines[0].type).toBe('exception');
      expect(result.lines[0].content).toContain('Exception in thread "main"');
    });

    it('should return empty result for non-stack trace text', () => {
      const stackTrace = `Just some regular text
No stack trace here`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(false);
      // Lines may exist but should be marked as unknown type
      result.lines.forEach(line => {
        expect(line.type).toBe('unknown');
      });
    });

    it('should handle file locations without line numbers', () => {
      const stackTrace = `java.lang.NullPointerException: Error
	at com.example.MyClass.myMethod(Native Method)
	at com.example.MyClass.anotherMethod(Unknown Source)`;
      
      const result = StackTraceParser.parseStackTrace(stackTrace);
      
      expect(result.hasStackTrace).toBe(true);
      expect(result.lines[1].fileName).toBe('Native Method');
      expect(result.lines[1].lineNumber).toBeUndefined();
      expect(result.lines[2].fileName).toBe('Unknown Source');
      expect(result.lines[2].lineNumber).toBeUndefined();
    });
  });

  describe('integration tests', () => {
    it('should extract and parse complex stack trace', () => {
      const input = `
2024-08-21 10:30:45 [ERROR] Request processing failed
java.lang.RuntimeException: Service unavailable
	at com.example.service.UserService.getUser(UserService.java:45)
	at com.example.controller.UserController.handleGetUser(UserController.java:25)
	at com.example.framework.RequestHandler.handle(RequestHandler.java:100)
	... 25 more
Caused by: java.net.ConnectException: Connection refused
	at java.base/java.net.Socket.connect(Socket.java:666)
	at com.example.database.ConnectionPool.getConnection(ConnectionPool.java:89)
	... 3 more
	Suppressed: java.lang.IllegalStateException: Pool is shutting down
		at com.example.database.ConnectionPool.checkState(ConnectionPool.java:120)
		at com.example.database.ConnectionPool.getConnection(ConnectionPool.java:85)
2024-08-21 10:30:46 [INFO] Retrying request...
`;
      
      const extracted = StackTraceParser.extractStackTrace(input);
      const parsed = StackTraceParser.parseStackTrace(extracted);
      
      expect(parsed.hasStackTrace).toBe(true);
      expect(parsed.lines.length).toBeGreaterThan(0);
      
      // Should have main exception
      const mainException = parsed.lines.find(line => 
        line.type === 'exception' && line.content.includes('java.lang.RuntimeException')
      );
      expect(mainException).toBeDefined();
      
      // Should have caused by
      const causedBy = parsed.lines.find(line => 
        line.type === 'caused_by' && line.content.includes('java.net.ConnectException')
      );
      expect(causedBy).toBeDefined();
      
      // Should have suppressed
      const suppressed = parsed.lines.find(line => 
        line.type === 'suppressed' && line.content.includes('java.lang.IllegalStateException')
      );
      expect(suppressed).toBeDefined();
      
      // Should have more lines
      const moreLine = parsed.lines.find(line => line.type === 'more');
      expect(moreLine).toBeDefined();
      
      // Should not include log messages
      expect(extracted).not.toContain('Request processing failed');
      expect(extracted).not.toContain('Retrying request');
    });

    it('should extract and parse serialized stack trace from JSON', () => {
      const input = `{
  "timestamp": "2024-08-21T10:30:45Z",
  "level": "ERROR",
  "message": "Service call failed",
  "exception": "java.lang.RuntimeException: Service unavailable\\n\\tat com.example.service.UserService.getUser(UserService.java:45)\\n\\tat com.example.controller.UserController.handleGetUser(UserController.java:25)\\nCaused by: java.net.ConnectException: Connection refused\\n\\tat java.base/java.net.Socket.connect(Socket.java:666)\\n\\tat com.example.database.ConnectionPool.getConnection(ConnectionPool.java:89)\\n\\tSuppressed: java.lang.IllegalStateException: Pool is shutting down\\n\\t\\tat com.example.database.ConnectionPool.checkState(ConnectionPool.java:120)"
}`;
      
      const extracted = StackTraceParser.extractStackTrace(input);
      const parsed = StackTraceParser.parseStackTrace(extracted);
      
      expect(parsed.hasStackTrace).toBe(true);
      expect(parsed.lines.length).toBeGreaterThan(0);
      
      // Should have main exception
      const mainException = parsed.lines.find(line => 
        line.type === 'exception' && line.content.includes('java.lang.RuntimeException')
      );
      expect(mainException).toBeDefined();
      
      // Should have caused by
      const causedBy = parsed.lines.find(line => 
        line.type === 'caused_by' && line.content.includes('java.net.ConnectException')
      );
      expect(causedBy).toBeDefined();
      
      // Should have suppressed
      const suppressed = parsed.lines.find(line => 
        line.type === 'suppressed' && line.content.includes('java.lang.IllegalStateException')
      );
      expect(suppressed).toBeDefined();
      
      // Should not include JSON structure
      expect(extracted).not.toContain('timestamp');
      expect(extracted).not.toContain('level');
      expect(extracted).not.toContain('message');
    });
  });
});
