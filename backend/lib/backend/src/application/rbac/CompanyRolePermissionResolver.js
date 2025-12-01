"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyRolePermissionResolver = void 0;
class CompanyRolePermissionResolver {
    constructor(modulePermRepo, companyRoleRepo) {
        this.modulePermRepo = modulePermRepo;
        this.companyRoleRepo = companyRoleRepo;
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
    async resolveAllRoles(companyId) {
        const moduleDefs = await this.modulePermRepo.list();
        const roles = await this.companyRoleRepo.getAll(companyId);
        await Promise.all(roles.map(async (role) => {
            const resolvedPermissions = this.resolveRole(role, moduleDefs);
            await this.companyRoleRepo.update(companyId, role.id, { resolvedPermissions });
        }));
    }
    async resolveRoleById(companyId, roleId) {
        const defList = await this.modulePermRepo.list();
        const role = await this.companyRoleRepo.getById(companyId, roleId);
        if (!role)
            return;
        const resolvedPermissions = this.resolveRole(role, defList);
        await this.companyRoleRepo.update(companyId, roleId, { resolvedPermissions });
    }
}
exports.CompanyRolePermissionResolver = CompanyRolePermissionResolver;
//# sourceMappingURL=CompanyRolePermissionResolver.js.map