"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthPermissionsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ModuleRegistry_1 = require("../../../application/platform/ModuleRegistry");
class AuthPermissionsController {
    static async getMyPermissions(req, res, next) {
        try {
            const user = req.user;
            const companyId = user.companyId;
            const isSuperAdmin = user.isSuperAdmin;
            if (!companyId) {
                return res.json({ success: true, data: { roleId: null, roleName: null, moduleBundles: [], explicitPermissions: [], resolvedPermissions: [], isSuperAdmin } });
            }
            const membership = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByUserAndCompany(user.uid, companyId);
            if (!membership) {
                return res.json({ success: true, data: { roleId: null, roleName: null, moduleBundles: [], explicitPermissions: [], resolvedPermissions: [], isSuperAdmin } });
            }
            const role = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, membership.roleId);
            const resolvedPermissions = (role === null || role === void 0 ? void 0 : role.resolvedPermissions) || (role === null || role === void 0 ? void 0 : role.permissions) || [];
            // Normalize/merge module assignments from company + role records.
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const moduleIds = new Set(ModuleRegistry_1.ModuleRegistry.getInstance()
                .getAllModules()
                .map((module) => String(module.metadata.id || '').trim().toLowerCase())
                .filter(Boolean));
            const companyModules = Array.isArray(company === null || company === void 0 ? void 0 : company.modules) ? company.modules : [];
            const roleModules = Array.isArray(role === null || role === void 0 ? void 0 : role.moduleBundles) ? role.moduleBundles : [];
            const normalizedRawModules = [...companyModules, ...roleModules]
                .map((moduleId) => String(moduleId || '').trim().toLowerCase())
                .filter(Boolean);
            let normalizedModules = Array.from(new Set(normalizedRawModules.filter((moduleId) => moduleIds.has(moduleId))));
            const hasOnlyLegacyTokens = normalizedRawModules.length > 0 && normalizedModules.length === 0;
            if (hasOnlyLegacyTokens) {
                const moduleStates = await bindRepositories_1.diContainer.companyModuleRepository.listByCompany(companyId);
                normalizedModules = Array.from(new Set(moduleStates
                    .filter((state) => state.initialized || state.initializationStatus === 'complete')
                    .map((state) => String(state.moduleCode || '').trim().toLowerCase())
                    .filter((moduleId) => moduleIds.has(moduleId))));
            }
            return res.json({
                success: true,
                data: {
                    roleId: membership.roleId,
                    roleName: (role === null || role === void 0 ? void 0 : role.name) || null,
                    moduleBundles: normalizedModules,
                    explicitPermissions: (role === null || role === void 0 ? void 0 : role.explicitPermissions) || (role === null || role === void 0 ? void 0 : role.permissions) || [],
                    resolvedPermissions,
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