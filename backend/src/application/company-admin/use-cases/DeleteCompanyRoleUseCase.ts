import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class DeleteCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository,
    private companyUserRepository: ICompanyUserRepository
  ) { }

  async execute(companyId: string, roleId: string): Promise<void> {
    // Validate companyId + roleId
    if (!companyId || !roleId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load role
    const role = await this.companyRoleRepository.getById(companyId, roleId);
    if (!role) {
      throw ApiError.notFound("Role not found");
    }

    // Block delete for system roles
    if (role.isSystem) {
      throw ApiError.forbidden("System roles cannot be deleted");
    }

    // Check if any users assigned to this role
    const users = await this.companyUserRepository.getByRole(companyId, roleId);
    if (users.length > 0) {
      throw ApiError.badRequest("Cannot delete a role that has active users");
    }

    // Delete
    await this.companyRoleRepository.delete(companyId, roleId);
  }
}
