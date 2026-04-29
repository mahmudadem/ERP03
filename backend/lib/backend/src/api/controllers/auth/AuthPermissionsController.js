"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthPermissionsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ModuleAvailabilityService_1 = require("../../../application/platform/ModuleAvailabilityService");
const CompanyModuleAccessResolver_1 = require("../../../application/company-admin/services/CompanyModuleAccessResolver");
const CompanyCapabilityAccessResolver_1 = require("../../../application/company-admin/services/CompanyCapabilityAccessResolver");
class AuthPermissionsController {
    static async getMyPermissions(req, res, next) {
        try {
            const user = req.user;
            const companyId = user.companyId;
            const isSuperAdmin = user.isSuperAdmin;
            if (!companyId) {
                return res.json({
                    success: true,
                    data: {
                        roleId: null,
                        roleName: null,
                        moduleBundles: [],
                        explicitPermissions: [],
                        resolvedPermissions: [],
                        isSuperAdmin
                    }
                });
            }
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(user.uid, companyId);
            if (!membership) {
                return res.json({
                    success: true,
                    data: {
                        roleId: null,
                        roleName: null,
                        moduleBundles: [],
                        explicitPermissions: [],
                        resolvedPermissions: [],
                        isSuperAdmin
                    }
                });
            }
            const role = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, membership.roleId);
            const resolvedPermissions = (role === null || role === void 0 ? void 0 : role.resolvedPermissions) || (role === null || role === void 0 ? void 0 : role.permissions) || [];
            const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
            const entitledModules = await bindRepositories_1.diContainer.entitlementService.getEntitledModules(companyId);
            const entitledModuleSet = new Set(entitledModules.map(m => m.toLowerCase()));
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const companyModules = await bindRepositories_1.diContainer.companyModuleRepository.listByCompany(companyId);
            const legacyModulesList = (company === null || company === void 0 ? void 0 : company.modules) || [];
            const legacyModuleSet = new Set(legacyModulesList.map((m) => m.toLowerCase()).filter(Boolean));
            const candidateModules = (0, CompanyModuleAccessResolver_1.resolveCompanyModuleAccess)({
                companyModules,
                legacyModules: legacyModulesList,
                entitledModules,
                roleModuleBundles: (role === null || role === void 0 ? void 0 : role.moduleBundles) || [],
                role,
                membership,
            });
            const availableForCompany = await service.getAvailableModulesForCompany(companyId);
            const finalModules = candidateModules
                .filter((moduleId) => {
                const isEntitled = entitledModuleSet.has(moduleId) || legacyModuleSet.has(moduleId);
                if (!isEntitled)
                    return false;
                const info = service.getAvailabilityInfo(moduleId);
                if (!info)
                    return false;
                if (info.state !== ModuleAvailabilityService_1.ModuleAvailabilityState.AVAILABLE &&
                    info.state !== ModuleAvailabilityService_1.ModuleAvailabilityState.SUSPENDED) {
                    return false;
                }
                return availableForCompany.includes(moduleId);
            });
            const capabilityParentModules = await (0, CompanyModuleAccessResolver_1.filterRuntimeAvailableModules)(companyId, finalModules, service);
            const enabledCapabilities = await (0, CompanyCapabilityAccessResolver_1.resolveEnabledCompanyCapabilityCodes)({
                companyId,
                accessibleModules: capabilityParentModules,
                capabilityRepository: bindRepositories_1.diContainer.capabilityRegistryRepository,
                entitlementRepository: bindRepositories_1.diContainer.companyEntitlementRepository,
            });
            return res.json({
                success: true,
                data: {
                    roleId: membership.roleId,
                    roleName: (role === null || role === void 0 ? void 0 : role.name) || null,
                    moduleBundles: finalModules,
                    explicitPermissions: (role === null || role === void 0 ? void 0 : role.explicitPermissions) || (role === null || role === void 0 ? void 0 : role.permissions) || [],
                    resolvedPermissions,
                    enabledCapabilities,
                    isSuperAdmin,
                },
            });
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.AuthPermissionsController = AuthPermissionsController;
//# sourceMappingURL=AuthPermissionsController.js.map