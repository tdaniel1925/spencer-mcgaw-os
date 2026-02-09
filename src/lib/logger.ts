/**
 * Structured logger for production use with request correlation
 *
 * Features:
 * - Request correlation IDs for tracing
 * - Structured JSON logging
 * - User context tracking
 * - Performance tracking
 * - Integration with Vercel logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LoggerOptions {
  requestId?: string;
  userId?: string;
  userEmail?: string;
  route?: string;
}

/**
 * Format log as structured JSON
 */
function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  options?: LoggerOptions
): string {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    service: 'spencer-mcgaw-hub',
    environment: process.env.NODE_ENV || 'development',
    ...(options?.requestId && { requestId: options.requestId }),
    ...(options?.userId && { userId: options.userId }),
    ...(options?.userEmail && { userEmail: options.userEmail }),
    ...(options?.route && { route: options.route }),
    ...context,
  };

  return JSON.stringify(logEntry);
}

/**
 * Determine if log should be output based on environment and level
 */
function shouldLog(level: LogLevel): boolean {
  const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');

  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const currentLevelIndex = levels.indexOf(logLevel as LogLevel);
  const messageLevelIndex = levels.indexOf(level);

  return messageLevelIndex >= currentLevelIndex;
}

/**
 * Base logger class
 */
class Logger {
  private options: LoggerOptions;

  constructor(options: LoggerOptions = {}) {
    this.options = options;
  }

  /**
   * Create a child logger with additional context
   */
  child(options: LoggerOptions): Logger {
    return new Logger({ ...this.options, ...options });
  }

  /**
   * Debug level - detailed information for diagnosing problems
   */
  debug(message: string, context?: LogContext): void {
    if (shouldLog('debug')) {
      console.debug(formatLog('debug', message, context, this.options));
    }
  }

  /**
   * Info level - general informational messages
   */
  info(message: string, context?: LogContext): void {
    if (shouldLog('info')) {
      console.info(formatLog('info', message, context, this.options));
    }
  }

  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn(message: string, context?: LogContext): void {
    if (shouldLog('warn')) {
      console.warn(formatLog('warn', message, context, this.options));
    }
  }

  /**
   * Error level - error events that might still allow the app to continue
   */
  error(message: string, context?: LogContext): void {
    if (shouldLog('error')) {
      // Extract error details if context contains an error object
      const errorDetails =
        context?.error instanceof Error
          ? {
              errorName: context.error.name,
              errorMessage: context.error.message,
              errorStack: context.error.stack,
            }
          : {};

      console.error(
        formatLog('error', message, { ...context, ...errorDetails }, this.options)
      );
    }
  }

  /**
   * Log API request start
   */
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.info(`API ${method} ${path}`, {
      ...context,
      type: 'api_request',
      method,
      path,
    });
  }

  /**
   * Log API response
   */
  apiResponse(
    method: string,
    path: string,
    status: number,
    durationMs?: number,
    context?: LogContext
  ): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    this[level](`API ${method} ${path} -> ${status}`, {
      ...context,
      type: 'api_response',
      method,
      path,
      status,
      durationMs,
    });
  }

  /**
   * Log database query performance
   */
  dbQuery(query: string, durationMs: number, context?: LogContext): void {
    const level = durationMs > 1000 ? 'warn' : 'debug';

    this[level]('Database query executed', {
      ...context,
      type: 'db_query',
      query: query.substring(0, 200), // Truncate long queries
      durationMs,
    });
  }

  /**
   * Log external API calls
   */
  externalRequest(
    service: string,
    method: string,
    endpoint: string,
    context?: LogContext
  ): void {
    this.info(`External API ${service} ${method} ${endpoint}`, {
      ...context,
      type: 'external_request',
      service,
      method,
      endpoint,
    });
  }

  /**
   * Log authentication events
   */
  auth(event: string, context?: LogContext): void {
    this.info(`Auth: ${event}`, {
      ...context,
      type: 'auth',
      event,
    });
  }

  /**
   * Log security events
   */
  security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';

    this[level](`Security: ${event}`, {
      ...context,
      type: 'security',
      event,
      severity,
    });
  }
}

/**
 * Create a request-specific logger with correlation ID
 */
export function createRequestLogger(requestId: string, userId?: string, userEmail?: string): Logger {
  return new Logger({ requestId, userId, userEmail });
}

/**
 * Default logger instance
 */
const logger = new Logger();

export default logger;
export { Logger };
