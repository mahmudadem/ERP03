"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemRoleController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const RolePermissionResolver_1 = require("../../../application/roles/RolePermissionResolver");
const resolver = new RolePermissionResolver_1.RolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.roleRepository);
class SystemRoleController {
    static async list(req, res, next) {
        try {
            const repo = bindRepositories_1.diContainer.roleRepository;
            const roles = repo.listSystemRoleTemplates
                ? await repo.listSystemRoleTemplates()
                : await repo.getCompanyRoles('');
            res.json({ success: true, data: roles });
        }
        catch (err) {
            next(err);
        }
    }
    static async get(req, res, next) {
        try {
            const role = await bindRepositories_1.diContainer.roleRepository.getRole(req.params.roleId);
            res.json({ success: true, data: role });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const { name, moduleBundles = [], explicitPermissions = [] } = req.body;
            const roleId = `role_${Date.now()}`;
            const role = {
                id: roleId,
                name,
                permissions: [],
                moduleBundles,
                explicitPermissions,
                resolvedPermissions: [],
            };
            await bindRepositories_1.diContainer.roleRepository.createRole('', role);
            await resolver.resolveRoleById(roleId);
            const saved = await bindRepositories_1.diContainer.roleRepository.getRole(roleId);
            res.json({ success: true, data: saved });
        }
        catch (err) {
            next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const { name, moduleBundles = [], explicitPermissions = [] } = req.body;
            await bindRepositories_1.diContainer.roleRepository.updateRole(req.params.roleId, {
                name,
                moduleBundles,
                explicitPermissions,
            });
            await resolver.resolveRoleById(req.params.roleId);
            const saved = await bindRepositories_1.diContainer.roleRepository.getRole(req.params.roleId);
            res.json({ success: true, data: saved });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.SystemRoleController = SystemRoleController;
//# sourceMappingURL=SystemRoleController.js.map