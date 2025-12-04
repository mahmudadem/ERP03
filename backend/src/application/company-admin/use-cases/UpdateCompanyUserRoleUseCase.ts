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
  updatedBy: string;
}

interface UpdateCompanyUserRoleResult {
  userId: string;
  companyId: string;
  roleId: string;
  roleName: string;
  updatedAt: Date;
}

export class UpdateCompanyUserRoleUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository,
    private companyRoleRepository: ICompanyRoleRepository
  ) {}

  async execute(input: UpdateCompanyUserRoleInput): Promise<UpdateCompanyUserRoleResult> {
    // 1. Load membership
    const membership = await this.companyUserRepository.getByUserAndCompany(
      input.userId,
      input.companyId
    );

    if (!membership) {
      throw ApiError.badRequest('User is not a member of this company');
    }

    // 2. Cannot modify owner role
    if (membership.isOwner === true) {
      throw ApiError.badRequest('Cannot change role of the owner');
    }

    // 3. Validate new role exists
    const newRole = await this.companyRoleRepository.getById(input.companyId, input.newRoleId);
    
    if (!newRole) {
      throw ApiError.badRequest('Invalid roleId');
    }

    // 4. Update the membership
    const updatedAt = new Date();
    await this.companyUserRepository.update(input.userId, input.companyId, {
      roleId: input.newRoleId,
      createdAt: updatedAt // Using createdAt as updatedAt since CompanyUser doesn't have updatedAt field
    });

    // 5. Return DTO
    return {
      userId: input.userId,
      companyId: input.companyId,
      roleId: input.newRoleId,
      roleName: newRole.name,
      updatedAt
    };
  }
}
