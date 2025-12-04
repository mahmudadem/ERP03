import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
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
    private companyRoleRepository: ICompanyRoleRepository
  ) { }

  async execute(input: CreateRoleInput): Promise<any> {
    // Validate
    if (!input.companyId || !input.name) {
      throw ApiError.badRequest("Missing required fields");
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
      roleId: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      createdAt: role.createdAt
    };
  }
}
