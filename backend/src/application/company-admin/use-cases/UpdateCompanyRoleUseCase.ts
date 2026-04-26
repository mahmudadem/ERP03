import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ApiError } from '../../../api/errors/ApiError';
import { PermissionCatalogSyncService } from '../../platform/PermissionCatalogSyncService';

export interface UpdateRoleInput {
  companyId: string;
  roleId: string;
  name?: string;
  description?: string;
  permissions?: string[];
}

export class UpdateCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository
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

    // Validate permissions against company-scoped catalog if provided
    if (input.permissions !== undefined && input.permissions.length > 0) {
      const syncService = new PermissionCatalogSyncService();
      const availablePerms = await syncService.getAvailablePermissions(input.companyId);
      const validSet = new Set(availablePerms.map(p => p.id));
      const invalid = input.permissions.filter(p => !validSet.has(p));
      if (invalid.length > 0) {
        throw ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the available catalog for your company's modules.`);
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
}