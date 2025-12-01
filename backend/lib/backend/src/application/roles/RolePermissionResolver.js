"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePermissionResolver = void 0;
class RolePermissionResolver {
    constructor(modulePermRepo, roleRepo) {
        this.modulePermRepo = modulePermRepo;
        this.roleRepo = roleRepo;
    }
    resolveRole(role, moduleDefs) {
        const resolved = new Set(role.explicitPermissions || []);
        const bundles = role.moduleBundles || [];
        bundles.forEach((modId) => {
            const def = moduleDefs.find((d) => d.moduleId === modId);
            if (def) {
                def.permissions
                    .filter((p) => p.enabled !== false)
                    .forEach((p) => resolved.add(p.id));
            }
        });
        return Array.from(resolved);
    }
    async resolveAllRoles() {
        const moduleDefs = await this.modulePermRepo.list();
        const roles = await (this.roleRepo.listSystemRoleTemplates ? this.roleRepo.listSystemRoleTemplates() : this.roleRepo.getCompanyRoles(''));
        await Promise.all(roles.map(async (role) => {
            const resolvedPermissions = this.resolveRole(role, moduleDefs);
            await this.roleRepo.updateRole(role.id, { resolvedPermissions });
        }));
    }
    async resolveRoleById(roleId) {
        const defList = await this.modulePermRepo.list();
        const role = await this.roleRepo.getRole(roleId);
        if (!role)
            return;
        const resolvedPermissions = this.resolveRole(role, defList);
        await this.roleRepo.updateRole(roleId, { resolvedPermissions });
    }
}
exports.RolePermissionResolver = RolePermissionResolver;
//# sourceMappingURL=RolePermissionResolver.js.map