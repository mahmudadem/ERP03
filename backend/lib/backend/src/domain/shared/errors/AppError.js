"use strict";
/**
 * Standardized Application Error Types
 *
 * Provides consistent error structure across the application,
 * especially for posting failures (core invariants + policies).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAggregatedPolicyError = exports.createPostingError = exports.PostingError = exports.ErrorCategory = void 0;
/**
 * Error categories for classification
 */
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["CORE_INVARIANT"] = "CORE_INVARIANT";
    ErrorCategory["POLICY"] = "POLICY";
    ErrorCategory["VALIDATION"] = "VALIDATION";
    ErrorCategory["AUTH"] = "AUTH";
    ErrorCategory["NOT_FOUND"] = "NOT_FOUND";
    ErrorCategory["CONFLICT"] = "CONFLICT";
})(ErrorCategory = exports.ErrorCategory || (exports.ErrorCategory = {}));
/**
 * PostingError
 *
 * Exception thrown when posting fails due to core invariants or policies.
 * Contains structured error information for API responses.
 */
class PostingError extends Error {
    constructor(appError) {
        super(appError.message);
        this.appError = appError;
        this.name = 'PostingError';
    }
    /**
     * Convert to API response format
     */
    toJSON() {
        return {
            success: false,
            error: this.appError
        };
    }
}
exports.PostingError = PostingError;
/**
 * Helper to create a PostingError from a single violation
 */
function createPostingError(code, message, category, fieldHints, policyId, correlationId) {
    return new PostingError({
        code,
        message,
        category,
        details: {
            violations: [
                {
                    code,
                    message,
                    fieldHints,
                    policyId
                }
            ]
        },
        correlationId
    });
}
exports.createPostingError = createPostingError;
/**
 * Helper to create an aggregated policy error
 */
function createAggregatedPolicyError(violations, correlationId) {
    return new PostingError({
        code: 'POLICY_VIOLATIONS',
        message: `${violations.length} policy violation(s) found`,
        category: ErrorCategory.POLICY,
        details: { violations },
        correlationId
    });
}
exports.createAggregatedPolicyError = createAggregatedPolicyError;
//# sourceMappingURL=AppError.js.map