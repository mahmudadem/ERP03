"use strict";
/**
 * Structured Logger
 *
 * Provides structured logging for observability.
 * Logs are output in JSON format for easy parsing by log aggregation tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.StructuredLogger = void 0;
/**
 * StructuredLogger
 *
 * Simple JSON-based structured logger.
 * Can be replaced with Winston, Bunyan, etc. in production.
 */
class StructuredLogger {
    /**
     * Log info-level event
     */
    info(event, data = {}) {
        const logEntry = Object.assign({ level: 'info', event, timestamp: new Date().toISOString() }, data);
        console.log(JSON.stringify(logEntry));
    }
    /**
     * Log error-level event
     */
    error(event, data = {}) {
        const logEntry = Object.assign({ level: 'error', event, timestamp: new Date().toISOString() }, data);
        console.error(JSON.stringify(logEntry));
    }
    /**
     * Log warning-level event
     */
    warn(event, data = {}) {
        const logEntry = Object.assign({ level: 'warn', event, timestamp: new Date().toISOString() }, data);
        console.warn(JSON.stringify(logEntry));
    }
    /**
     * Log debug-level event
     */
    debug(event, data = {}) {
        const logEntry = Object.assign({ level: 'debug', event, timestamp: new Date().toISOString() }, data);
        console.debug(JSON.stringify(logEntry));
    }
}
exports.StructuredLogger = StructuredLogger;
/**
 * Global logger instance
 */
exports.logger = new StructuredLogger();
//# sourceMappingURL=StructuredLogger.js.map