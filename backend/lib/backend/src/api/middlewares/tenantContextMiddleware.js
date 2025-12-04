"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContextMiddleware = void 0;
const ApiError_1 = require("../errors/ApiError");
const tenantContextMiddleware = (req, res, next) => {
    const user = req.user;
    if (!user) {
        return next(ApiError_1.ApiError.unauthorized('User not authenticated'));
    }
    if (!user.companyId) {
        return next(ApiError_1.ApiError.badRequest('Company Context Required: No companyId found in user session or headers.'));
    }
    // Future: Check if module is enabled for this company (Phase 3)
    next();
};
exports.tenantContextMiddleware = tenantContextMiddleware;
//# sourceMappingURL=tenantContextMiddleware.js.map