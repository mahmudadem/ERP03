"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerOrPermissionGuard = void 0;
const ApiError_1 = require("../../errors/ApiError");
/**
 * ownerOrPermissionGuard
 * Middleware that allows access if user is owner OR has specific permission
 *
 * @param requiredPermission - The permission code required (e.g., 'system.company.manage')
 * @returns Express middleware function
 */
function ownerOrPermissionGuard(requiredPermission) {
    return (req, res, next) => {
        try {
            // Get user from request (set by authMiddleware)
            const user = req.user;
            if (!user) {
                return next(ApiError_1.ApiError.unauthorized('User not authenticated'));
            }
            // Get tenant context (set by tenantContextMiddleware)
            const tenantContext = req.tenantContext;
            if (!tenantContext) {
                return next(ApiError_1.ApiError.internal('Tenant context not initialized'));
            }
            // Check if user is owner - owners bypass permission checks
            if (user.isOwner === true) {
                return next();
            }
            // Check if user has the required permission
            if (!tenantContext.permissions || !Array.isArray(tenantContext.permissions)) {
                return next(ApiError_1.ApiError.forbidden(`Permission denied: ${requiredPermission}`));
            }
            if (!tenantContext.permissions.includes(requiredPermission)) {
                return next(ApiError_1.ApiError.forbidden(`Permission denied: ${requiredPermission}`));
            }
            // User has permission, allow access
            next();
        }
        catch (error) {
            next(error);
        }
    };
}
exports.ownerOrPermissionGuard = ownerOrPermissionGuard;
//# sourceMappingURL=ownerOrPermissionGuard.js.map