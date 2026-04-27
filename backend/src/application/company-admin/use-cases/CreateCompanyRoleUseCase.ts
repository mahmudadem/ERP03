import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { IPermissionRegistryRepository } from '../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { ApiError } from '../../../api/errors/ApiError';
import { PermissionCatalogSyncService } from '../../platform/PermissionCatalogSyncService';
import { deriveModuleBundlesFromPermissions } from '../services/RoleModuleBundleDeriver';

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

    // Validate permissions against company-scoped catalog
    if (input.permissions && input.permissions.length > 0) {
      const syncService = new PermissionCatalogSyncService();
      const availablePerms = await syncService.getAvailablePermissions(input.companyId);
      const validSet = new Set(availablePerms.map(p => p.id));
      const invalid = input.permissions.filter(p => !validSet.has(p));
      if (invalid.length > 0) {
        throw ApiError.badRequest(`Invalid permissions: ${invalid.join(', ')}. Permissions must be from the available catalog for your company's modules.`);
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
      explicitPermissions: input.permissions || [],
      resolvedPermissions: input.permissions || [],
      moduleBundles: deriveModuleBundlesFromPermissions(input.permissions || []),
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
      explicitPermissions: role.explicitPermissions,
      resolvedPermissions: role.resolvedPermissions,
      moduleBundles: role.moduleBundles,
      isSystem: role.isSystem,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt
    };
  }
}
