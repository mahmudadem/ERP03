import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export interface UpdateRoleInput {
  companyId: string;
  roleId: string;
  name?: string;
  description?: string;
  permissions?: string[];
}

export class UpdateCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository,
    private permissionRegistryRepository?: IPermissionRegistryRepository
  ) { }

  async execute(input: UpdateRoleInput): Promise<void> {
    // Validate companyId + roleId
    if (!input.companyId || !input.roleId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load original role
    const role = await this.companyRoleRepository.getById(input.companyId, input.roleId);
    if (!role) {
      throw ApiError.notFound("Role not found");
    }

    // Block system roles
    if (role.isSystem) {
      throw ApiError.forbidden("System roles cannot be modified");
    }

    // Validate permissions against catalog if provided
    if (input.permissions !== undefined && input.permissions.length > 0 && this.permissionRegistryRepository) {
      const invalid = await this.validatePermissions(input.permissions);
      if (invalid.length > 0) {
        throw ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the catalog.`);
      }
    }

    // Apply updates to name, description, permissions only
    const name = input.name !== undefined ? input.name : role.name;
    const description = input.description !== undefined ? input.description : role.description;
    const permissions = input.permissions !== undefined ? input.permissions : role.permissions;

    // Save
    await this.companyRoleRepository.update(input.companyId, input.roleId, {
      name,
      description,
      permissions,
      updatedAt: new Date()
    });
  }

  private async validatePermissions(permissions: string[]): Promise<string[]> {
    const catalog = await this.permissionRegistryRepository!.getAll();
    const validSet = new Set(catalog.map(p => p.id));
    return permissions.filter(p => !validSet.has(p));
  }
}
