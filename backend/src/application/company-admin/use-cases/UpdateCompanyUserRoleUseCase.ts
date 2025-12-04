/**
 * UpdateCompanyUserRoleUseCase
 * Changes a user's role within the company
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ApiError } from '../../../api/errors/ApiError';

interface UpdateCompanyUserRoleInput {
  companyId: string;
  userId: string;
  newRoleId: string;
}

export class UpdateCompanyUserRoleUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository,
    private companyRoleRepository: ICompanyRoleRepository
  ) { }

  async execute(input: UpdateCompanyUserRoleInput): Promise<any> {
    // Validate inputs
    if (!input.companyId || !input.userId || !input.newRoleId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load the membership
    const membership = await this.companyUserRepository.get(input.companyId, input.userId);
    if (!membership) {
      throw ApiError.notFound("User is not a member of this company");
    }

    // Ensure you cannot change the owner's role
    if (membership.isOwner) {
      throw ApiError.forbidden("Cannot change the role of the company owner");
    }

    // Ensure role exists
    const role = await this.companyRoleRepository.getById(input.companyId, input.newRoleId);
    if (!role) {
      throw ApiError.notFound("Role not found");
    }

    // Update membership
    await this.companyUserRepository.update(input.userId, input.companyId, { roleId: input.newRoleId });

    // Return success DTO
    return {
      userId: input.userId,
      companyId: input.companyId,
      roleId: input.newRoleId,
      updatedAt: new Date()
    };
  }
}
