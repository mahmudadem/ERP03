"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * server/index.ts
 * Purpose: Configures the Express Application.
 */
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const router_1 = __importDefault(require("./router"));
const errorHandler_1 = require("../errors/errorHandler");
const impersonationMiddleware_1 = require("../middlewares/impersonationMiddleware");
const app = (0, express_1.default)();
// Global Middlewares
// Fix: cast to any to resolve NextHandleFunction vs RequestHandler type mismatch errors
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Apply Impersonation Middleware first (checks X-Impersonation-Token header)
app.use(impersonationMiddleware_1.impersonationMiddleware);
// Company Context is now handled by TenantRouter for specific routes
// app.use(companyContextMiddleware as any);
// Mount Routes
app.use('/api/v1', router_1.default);
// Catch-all for 404
app.use((req, res, next) => {
    const { ApiError } = require('../errors/ApiError');
    next(ApiError.notFound(`Endpoint not found: ${req.method} ${req.path}`));
});
// Global Error Handler (Must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=index.js.map