"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = void 0;
const AppError_1 = require("./AppError");
const ErrorCodes_1 = require("./ErrorCodes");
const ProviderErrors_1 = require("./ProviderErrors");
function isFirestoreTransactionError(err) {
    const msg = err.message || '';
    return (msg.includes('all reads to be executed before all writes') ||
        msg.includes('Firestore transactions require') ||
        err.code === 'INVALID_ARGUMENT' ||
        err.code === 'ABORTED');
}
function errorHandler(err, req, res, next) {
    console.error('[Error Handler]', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
    });
    if (err instanceof AppError_1.AppError) {
        // Provider errors have specific HTTP status codes that don't follow the
        // severity mapping (e.g., 503 for unavailable, 429 for rate limit).
        // Handle them with their own status mapping.
        if (err instanceof ProviderErrors_1.ProviderError) {
            const statusCode = getProviderErrorStatus(err);
            const response = {
                success: false,
                error: err.toJSON(),
            };
            return res.status(statusCode).json(response);
        }
        const response = {
            success: false,
            error: err.toJSON(),
        };
        const statusCode = getStatusCode(err.severity);
        return res.status(statusCode).json(response);
    }
    // Detect Firestore transaction read-after-write violations
    if (isFirestoreTransactionError(err)) {
        const response = {
            success: false,
            error: {
                code: ErrorCodes_1.ErrorCode.INFRA_TRANSACTION_CONFLICT,
                message: process.env.NODE_ENV === 'production'
                    ? 'A transaction conflict occurred. Please retry the operation.'
                    : err.message,
                severity: ErrorCodes_1.ErrorSeverity.CRITICAL,
                timestamp: new Date().toISOString(),
            },
        };
        return res.status(409).json(response);
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
 * Map ProviderError subclasses to correct HTTP status codes.
 * These don't follow the generic severity mapping — each type has a specific status.
 */
function getProviderErrorStatus(err) {
    switch (err.code) {
        case ErrorCodes_1.ErrorCode.AI_PROVIDER_UNAVAILABLE:
            return 503;
        case ErrorCodes_1.ErrorCode.AI_PROVIDER_AUTH_ERROR:
            return 401;
        case ErrorCodes_1.ErrorCode.AI_PROVIDER_RATE_LIMIT:
            return 429;
        case ErrorCodes_1.ErrorCode.AI_PROVIDER_ERROR:
        default:
            return 502;
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