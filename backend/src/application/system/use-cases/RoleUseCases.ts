
import { Role } from '../../../domain/system/entities/Role';
import { IRoleRepository } from '../../../repository/interfaces/system';
import { IPermissionRepository } from '../../../repository/interfaces/system';

export class CreateRoleUseCase {
  constructor(private roleRepository: IRoleRepository) {}

  async execute(companyId: string, name: string, permissions: string[]): Promise<void> {
    const roleId = `role_${Date.now()}`;
    const role = new Role(roleId, name, permissions);
    await this.roleRepository.createRole(companyId, role);
  }
}

export class UpdateRolePermissionsUseCase {
  constructor(
    private roleRepository: IRoleRepository,
    private permissionRepository: IPermissionRepository
  ) {}

  async execute(roleId: string, permissions: string[]): Promise<void> {
    const role = await this.roleRepository.getRole(roleId);
    if (!role) throw new Error('Role not found');
    
    // Domain entity update
    role.permissions = permissions;
    
    // Persist
    await this.roleRepository.updateRole(roleId, { permissions });
    
    // If permission repo needs specific linking
    await this.permissionRepository.assignPermissions(roleId, permissions);
  }
}
