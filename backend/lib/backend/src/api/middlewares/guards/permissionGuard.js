"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
function permissionGuard(requiredPermission) {
    return (req, res, next) => {
        const context = req.tenantContext;
        if (!context) {
            return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
        }
        // Check if user has the specific permission OR wildcard
        if (!context.permissions.includes('*') && !context.permissions.includes(requiredPermission)) {
            return next(ApiError_1.ApiError.forbidden(`Permission denied: ${requiredPermission}`));
        }
        next();
    };
}
exports.permissionGuard = permissionGuard;
//# sourceMappingURL=permissionGuard.js.map