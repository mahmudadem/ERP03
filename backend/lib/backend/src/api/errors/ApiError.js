"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
/**
 * ApiError.ts
 * Purpose: Standardized error class for HTTP responses.
 */
class ApiError extends Error {
    constructor(statusCode, message, code = 'API_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.name = 'ApiError';
    }
    static badRequest(message, code = 'BAD_REQUEST') {
        return new ApiError(400, message, code);
    }
    static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        return new ApiError(401, message, code);
    }
    static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
        return new ApiError(403, message, code);
    }
    static notFound(message = 'Not Found', code = 'NOT_FOUND') {
        return new ApiError(404, message, code);
    }
    static internal(message = 'Internal Server Error', code = 'INTERNAL_ERROR') {
        return new ApiError(500, message, code);
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=ApiError.js.map