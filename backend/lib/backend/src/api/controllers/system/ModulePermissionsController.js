"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModulePermissionsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const RolePermissionResolver_1 = require("../../../application/roles/RolePermissionResolver");
class ModulePermissionsController {
    static async listModules(req, res, next) {
        try {
            const defs = await bindRepositories_1.diContainer.modulePermissionsDefinitionRepository.list();
            res.json({ success: true, data: defs });
        }
        catch (err) {
            next(err);
        }
    }
    static async getByModule(req, res, next) {
        try {
            const { moduleId } = req.params;
            const def = await bindRepositories_1.diContainer.modulePermissionsDefinitionRepository.getByModuleId(moduleId);
            res.json({ success: true, data: def });
        }
        catch (err) {
            next(err);
        }
    }
    static async upsert(req, res, next) {
        try {
            const { moduleId } = req.params;
            const body = req.body;
            const def = {
                moduleId,
                permissions: body.permissions || [],
                autoAttachToRoles: body.autoAttachToRoles || [],
                createdAt: body.createdAt || new Date(),
                updatedAt: new Date(),
                permissionsDefined: true
            };
            await bindRepositories_1.diContainer.modulePermissionsDefinitionRepository.update(moduleId, def);
            const resolver = new RolePermissionResolver_1.RolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.roleRepository);
            await resolver.resolveAllRoles();
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const body = req.body;
            const def = {
                moduleId: body.moduleId,
                permissions: body.permissions || [],
                autoAttachToRoles: body.autoAttachToRoles || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                permissionsDefined: true
            };
            await bindRepositories_1.diContainer.modulePermissionsDefinitionRepository.create(def);
            const resolver = new RolePermissionResolver_1.RolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.roleRepository);
            await resolver.resolveAllRoles();
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async remove(req, res, next) {
        try {
            const { moduleId } = req.params;
            await bindRepositories_1.diContainer.modulePermissionsDefinitionRepository.delete(moduleId);
            const resolver = new RolePermissionResolver_1.RolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.roleRepository);
            await resolver.resolveAllRoles();
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ModulePermissionsController = ModulePermissionsController;
//# sourceMappingURL=ModulePermissionsController.js.map