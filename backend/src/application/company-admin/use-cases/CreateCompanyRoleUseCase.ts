import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { ApiError } from '../../../api/errors/ApiError';

export interface CreateRoleInput {
  companyId: string;
  name: string;
  description?: string;
  permissions?: string[];
}

export class CreateCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository,
    private permissionRegistryRepository?: IPermissionRegistryRepository
  ) { }

  async execute(input: CreateRoleInput): Promise<any> {
    // Validate
    if (!input.companyId || !input.name) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Validate permissions against catalog if registry available
    if (input.permissions && input.permissions.length > 0 && this.permissionRegistryRepository) {
      const invalid = await this.validatePermissions(input.permissions);
      if (invalid.length > 0) {
        throw ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the catalog.`);
      }
    }

    // Generate roleId
    const roleId = `role_${Date.now()}`;

    // Create role object
    const role: CompanyRole = {
      id: roleId,
      companyId: input.companyId,
      name: input.name,
      description: input.description || '',
      permissions: input.permissions || [],
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save
    await this.companyRoleRepository.create(role);

    // Return DTO
    return {
      id: role.id,
      companyId: role.companyId,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }

  private async validatePermissions(permissions: string[]): Promise<string[]> {
    const catalog = await this.permissionRegistryRepository!.getAll();
    const validSet = new Set(catalog.map(p => p.id));
    return permissions.filter(p => !validSet.has(p));
  }
}
