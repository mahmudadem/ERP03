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
        // Check if user has the specific permission, wildcard, or a parent permission
        const hasPermission = context.permissions.some((perm) => {
            // Wildcard grants all
            if (perm === '*')
                return true;
            // Exact match
            if (perm === requiredPermission)
                return true;
            // Hierarchical: if user has "accounting.settings", it grants "accounting.settings.read"
            if (requiredPermission.startsWith(perm + '.'))
                return true;
            return false;
        });
        if (!hasPermission) {
            return next(ApiError_1.ApiError.forbidden(`Permission denied: ${requiredPermission}`));
        }
        next();
    };
}
exports.permissionGuard = permissionGuard;
//# sourceMappingURL=permissionGuard.js.map