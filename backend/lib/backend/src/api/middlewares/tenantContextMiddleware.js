"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContextMiddleware = void 0;
const ApiError_1 = require("../errors/ApiError");
const bindRepositories_1 = require("../../infrastructure/di/bindRepositories");
const CompanyModuleAccessResolver_1 = require("../../application/company-admin/services/CompanyModuleAccessResolver");
const CompanyCapabilityAccessResolver_1 = require("../../application/company-admin/services/CompanyCapabilityAccessResolver");
const tenantContextMiddleware = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return next(ApiError_1.ApiError.unauthorized('User not authenticated'));
        }
        if (!user.companyId) {
            return next(ApiError_1.ApiError.badRequest('Company Context Required: No companyId found in user session.'));
        }
        const companyId = user.companyId;
        const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
        if (!company || company.id !== user.companyId) {
            return next(ApiError_1.ApiError.forbidden('Invalid company context'));
        }
        let permissions = [];
        let roleModuleBundles = [];
        let role = null;
        if (user.roleId) {
            role = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, user.roleId);
            if (role) {
                permissions = role.resolvedPermissions || role.permissions || [];
                roleModuleBundles = role.moduleBundles || [];
            }
        }
        const companyModules = await bindRepositories_1.diContainer.companyModuleRepository.listByCompany(companyId);
        const entitledModules = await bindRepositories_1.diContainer.entitlementService.getEntitledModules(companyId);
        const finalModules = (0, CompanyModuleAccessResolver_1.resolveCompanyModuleAccess)({
            companyModules,
            legacyModules: (company.modules || []),
            entitledModules,
            roleModuleBundles,
            role,
            membership: {
                roleId: user.roleId || undefined,
                isOwner: user.isOwner,
            },
        });
        const capabilityParentModules = await (0, CompanyModuleAccessResolver_1.filterRuntimeAvailableModules)(companyId, finalModules);
        const enabledFeatures = await (0, CompanyCapabilityAccessResolver_1.resolveEnabledCompanyCapabilityCodes)({
            companyId,
            accessibleModules: capabilityParentModules,
            capabilityRepository: bindRepositories_1.diContainer.capabilityRegistryRepository,
            entitlementRepository: bindRepositories_1.diContainer.companyEntitlementRepository,
        });
        console.log(`[TenantContext] User: ${user.uid}, Role: ${user.roleId}, Company: ${companyId}`);
        console.log(`[TenantContext] Final modules: ${JSON.stringify(capabilityParentModules)}`);
        req.tenantContext = {
            userId: user.uid,
            companyId: companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules: capabilityParentModules,
            features: enabledFeatures
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.tenantContextMiddleware = tenantContextMiddleware;
//# sourceMappingURL=tenantContextMiddleware.js.map