/**
 * Structured Logger
 * 
 * Provides structured logging for observability.
 * Logs are output in JSON format for easy parsing by log aggregation tools.
 */

export interface LogData {
  [key: string]: any;
}

/**
 * StructuredLogger
 * 
 * Simple JSON-based structured logger.
 * Can be replaced with Winston, Bunyan, etc. in production.
 */
export class StructuredLogger {
  /**
   * Log info-level event
   */
  info(event: string, data: LogData = {}) {
    const logEntry = {
      level: 'info',
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    console.log(JSON.stringify(logEntry));
  }

  /**
   * Log error-level event
   */
  error(event: string, data: LogData = {}) {
    const logEntry = {
      level: 'error',
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    console.error(JSON.stringify(logEntry));
  }

  /**
   * Log warning-level event
   */
  warn(event: string, data: LogData = {}) {
    const logEntry = {
      level: 'warn',
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    console.warn(JSON.stringify(logEntry));
  }

  /**
   * Log debug-level event
   */
  debug(event: string, data: LogData = {}) {
    const logEntry = {
      level: 'debug',
      event,
      timestamp: new Date().toISOString(),
      ...data
    };

    console.debug(JSON.stringify(logEntry));
  }
}

/**
 * Global logger instance
 */
export const logger = new StructuredLogger();
