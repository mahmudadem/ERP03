"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const ApiError_1 = require("./ApiError");
const InfrastructureError_1 = require("../../infrastructure/errors/InfrastructureError");
const errorHandler = (err, req, res, next) => {
    console.error(`[API Error] ${req.method} ${req.path}:`, err);
    if (err instanceof ApiError_1.ApiError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
        });
        return;
    }
    // Handle Infrastructure Errors (Database, etc)
    if (err instanceof InfrastructureError_1.InfrastructureError) {
        res.status(500).json({
            success: false,
            error: {
                code: 'INFRASTRUCTURE_ERROR',
                message: 'A system error occurred. Please try again later.',
            },
        });
        return;
    }
    // Handle errors with explicit statusCode (e.g., validation conflicts)
    const anyErr = err;
    if (anyErr === null || anyErr === void 0 ? void 0 : anyErr.statusCode) {
        res.status(anyErr.statusCode).json({
            success: false,
            error: {
                code: anyErr.statusCode === 400 ? 'BAD_REQUEST' : anyErr.statusCode === 409 ? 'CONFLICT' : 'ERROR',
                message: err.message,
            },
        });
        return;
    }
    // Fallback for unhandled errors
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
        },
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map