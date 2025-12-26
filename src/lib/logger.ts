/**
 * Structured logger for production use
 * In production, logs are sent to Vercel's logging infrastructure
 * In development, logs are shown in console with context
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

function shouldLog(level: LogLevel): boolean {
  // In production, only log warnings and errors
  if (process.env.NODE_ENV === "production") {
    return level === "warn" || level === "error";
  }
  return true;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (shouldLog("debug")) {
      console.debug(formatLog("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    if (shouldLog("info")) {
      console.info(formatLog("info", message, context));
    }
  },

  warn(message: string, context?: LogContext): void {
    if (shouldLog("warn")) {
      console.warn(formatLog("warn", message, context));
    }
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (shouldLog("error")) {
      const errorDetails = error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { error };
      console.error(formatLog("error", message, { ...context, ...errorDetails }));
    }
  },

  /**
   * Log API request for debugging
   */
  apiRequest(method: string, path: string, context?: LogContext): void {
    this.debug(`API ${method} ${path}`, context);
  },

  /**
   * Log API response for debugging
   */
  apiResponse(method: string, path: string, status: number, duration?: number): void {
    this.debug(`API ${method} ${path} -> ${status}`, { duration });
  },
};

export default logger;
