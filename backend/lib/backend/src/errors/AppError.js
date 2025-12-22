"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureError = exports.AuthError = exports.BusinessError = exports.ValidationError = exports.AppError = void 0;
const ErrorCodes_1 = require("./ErrorCodes");
/**
 * Base Application Error
 */
class AppError extends Error {
    constructor(code, message, severity = ErrorCodes_1.ErrorSeverity.ERROR, field, context) {
        super(message);
        this.code = code;
        this.message = message;
        this.severity = severity;
        this.field = field;
        this.context = context;
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            severity: this.severity,
            field: this.field,
            context: this.context,
            timestamp: new Date().toISOString(),
        };
    }
}
exports.AppError = AppError;
/**
 * Validation Error
 */
class ValidationError extends AppError {
    constructor(message, field, context) {
        super(ErrorCodes_1.ErrorCode.VAL_REQUIRED_FIELD, message, ErrorCodes_1.ErrorSeverity.WARNING, field, context);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
/**
 * Business Logic Error
 */
class BusinessError extends AppError {
    constructor(code, message, context) {
        super(code, message, ErrorCodes_1.ErrorSeverity.ERROR, undefined, context);
        this.name = 'BusinessError';
    }
}
exports.BusinessError = BusinessError;
/**
 * Authentication Error
 */
class AuthError extends AppError {
    constructor(code, message, context) {
        super(code, message, ErrorCodes_1.ErrorSeverity.ERROR, undefined, context);
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
/**
 * Infrastructure Error
 */
class InfrastructureError extends AppError {
    constructor(message, originalError) {
        super(ErrorCodes_1.ErrorCode.INFRA_DATABASE_ERROR, message, ErrorCodes_1.ErrorSeverity.CRITICAL, undefined, { originalError: originalError === null || originalError === void 0 ? void 0 : originalError.message });
        this.name = 'InfrastructureError';
    }
}
exports.InfrastructureError = InfrastructureError;
//# sourceMappingURL=AppError.js.map