"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureError = void 0;
/**
 * InfrastructureError.ts
 *
 * Purpose:
 * Wraps underlying database or external service errors into a unified application error.
 * Prevents leaking raw database details (like stack traces or driver-specific codes) to the application layer.
 */
class InfrastructureError extends Error {
    constructor(message, originalError, code = 'INFRA_ERROR') {
        super(message);
        this.message = message;
        this.originalError = originalError;
        this.code = code;
        this.name = 'InfrastructureError';
        // Maintain stack trace
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, InfrastructureError);
        }
    }
}
exports.InfrastructureError = InfrastructureError;
//# sourceMappingURL=InfrastructureError.js.map