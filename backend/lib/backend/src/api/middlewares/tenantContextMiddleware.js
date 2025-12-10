"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContextMiddleware = void 0;
const ApiError_1 = require("../errors/ApiError");
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const tenantContextMiddleware = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(ApiError_1.ApiError.unauthorized('User not authenticated'));
        }
        if (!user.companyId) {
            return next(ApiError_1.ApiError.badRequest('Company Context Required: No companyId found in user session.'));
        }
        // CRITICAL: companyId MUST come ONLY from req.user.companyId
        // Block any attempts to load companyId from req.body, req.query, or req.params
        const companyId = user.companyId;
        // 1. Load Company to get Modules
        const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
        // Tenant Isolation Check: Ensure company exists and matches authenticated user's company
        if (!company || company.id !== user.companyId) {
            return next(ApiError_1.ApiError.forbidden('Invalid company context'));
        }
        // 2. Load Permissions from User's Role
        let permissions = [];
        if (user.roleId) {
            const role = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, user.roleId);
            if (role) {
                permissions = role.resolvedPermissions || role.permissions || [];
            }
        }
        // NOTE: Features were part of the old bundle structure
        // With the new businessDomains-based bundle structure, features are not tracked
        const features = [];
        // 4. Set Tenant Context with ALL required fields
        console.log(`[TenantContext] User: ${user.uid}, Role: ${user.roleId}, Company: ${companyId}`);
        console.log(`[TenantContext] Permissions: ${JSON.stringify(permissions)}`);
        req.tenantContext = {
            userId: user.uid,
            companyId: companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules: company.modules || [],
            features: features
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.tenantContextMiddleware = tenantContextMiddleware;
//# sourceMappingURL=tenantContextMiddleware.js.map