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
            return res.json({
                success: true,
                data: {
                    roleId: membership.roleId,
                    roleName: (role === null || role === void 0 ? void 0 : role.name) || null,
                    moduleBundles: (role === null || role === void 0 ? void 0 : role.moduleBundles) || [],
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