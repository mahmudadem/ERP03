"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthPermissionsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
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
            // Read active modules from company document (source of truth)
            // instead of role.moduleBundles which is stale after new modules are enabled
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            const companyModules = (company === null || company === void 0 ? void 0 : company.modules) || (role === null || role === void 0 ? void 0 : role.moduleBundles) || [];
            return res.json({
                success: true,
                data: {
                    roleId: membership.roleId,
                    roleName: (role === null || role === void 0 ? void 0 : role.name) || null,
                    moduleBundles: companyModules,
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