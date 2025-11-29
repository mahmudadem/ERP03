import { ModulePermissionsDefinition } from '../../domain/system/ModulePermissionsDefinition';
import { IModulePermissionsDefinitionRepository } from '../../repository/interfaces/system/IModulePermissionsDefinitionRepository';
import { IRoleRepository } from '../../repository/interfaces/system/IRoleRepository';

export class RolePermissionResolver {
  constructor(
    private modulePermRepo: IModulePermissionsDefinitionRepository,
    private roleRepo: IRoleRepository
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

  async resolveAllRoles() {
    const moduleDefs = await this.modulePermRepo.list();
    const roles = await (this.roleRepo.listSystemRoleTemplates ? this.roleRepo.listSystemRoleTemplates() : this.roleRepo.getCompanyRoles(''));
    await Promise.all(
      roles.map(async (role) => {
        const resolvedPermissions = this.resolveRole(role, moduleDefs);
        await this.roleRepo.updateRole(role.id, { resolvedPermissions });
      })
    );
  }

  async resolveRoleById(roleId: string) {
    const defList = await this.modulePermRepo.list();
    const role = await this.roleRepo.getRole(roleId);
    if (!role) return;
    const resolvedPermissions = this.resolveRole(role, defList);
    await this.roleRepo.updateRole(roleId, { resolvedPermissions });
  }
}
