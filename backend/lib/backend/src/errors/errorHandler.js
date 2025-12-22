"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = void 0;
const AppError_1 = require("./AppError");
const ErrorCodes_1 = require("./ErrorCodes");
/**
 * Global Error Handler Middleware
 *
 * Catches all errors and formats them into consistent API responses
 */
function errorHandler(err, req, res, next) {
    // Log error for debugging
    console.error('[Error Handler]', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
    });
    // Check if it's our custom AppError
    if (err instanceof AppError_1.AppError) {
        const response = {
            success: false,
            error: err.toJSON(),
        };
        const statusCode = getStatusCode(err.severity);
        return res.status(statusCode).json(response);
    }
    // Handle unknown errors
    const response = {
        success: false,
        error: {
            code: ErrorCodes_1.ErrorCode.INFRA_UNKNOWN_ERROR,
            message: process.env.NODE_ENV === 'production'
                ? 'An unexpected error occurred'
                : err.message,
            severity: ErrorCodes_1.ErrorSeverity.CRITICAL,
            timestamp: new Date().toISOString(),
        },
    };
    res.status(500).json(response);
}
exports.errorHandler = errorHandler;
/**
 * Map error severity to HTTP status code
 */
function getStatusCode(severity) {
    switch (severity) {
        case ErrorCodes_1.ErrorSeverity.INFO:
            return 200;
        case ErrorCodes_1.ErrorSeverity.WARNING:
            return 400;
        case ErrorCodes_1.ErrorSeverity.ERROR:
            return 400;
        case ErrorCodes_1.ErrorSeverity.CRITICAL:
            return 500;
        default:
            return 500;
    }
}
/**
 * Async handler wrapper to catch errors in async route handlers
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map