import { ModulePermissionsDefinition } from '../../domain/system/ModulePermissionsDefinition';
import { IModulePermissionsDefinitionRepository } from '../../repository/interfaces/system/IModulePermissionsDefinitionRepository';
import { ICompanyRoleRepository } from '../../repository/interfaces/rbac/ICompanyRoleRepository';

export class CompanyRolePermissionResolver {
  constructor(
    private modulePermRepo: IModulePermissionsDefinitionRepository,
    private companyRoleRepo: ICompanyRoleRepository
  ) {}

  private resolveRole(role: any, moduleDefs: ModulePermissionsDefinition[]) {
    const resolved = new Set<string>(role.explicitPermissions || []);
    const bundles: string[] = role.moduleBundles || [];
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

  async resolveAllRoles(companyId: string) {
    const moduleDefs = await this.modulePermRepo.list();
    const roles = await this.companyRoleRepo.getAll(companyId);
    await Promise.all(
      roles.map(async (role) => {
        const resolvedPermissions = this.resolveRole(role, moduleDefs);
        await this.companyRoleRepo.update(companyId, role.id, { resolvedPermissions });
      })
    );
  }

  async resolveRoleById(companyId: string, roleId: string) {
    const defList = await this.modulePermRepo.list();
    const role = await this.companyRoleRepo.getById(companyId, roleId);
    if (!role) return;
    const resolvedPermissions = this.resolveRole(role, defList);
    await this.companyRoleRepo.update(companyId, roleId, { resolvedPermissions });
  }
}
