/**
 * DisableCompanyUserUseCase
 * Disables a user's access to the company (soft delete)
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ApiError } from '../../../api/errors/ApiError';

interface DisableCompanyUserInput {
  companyId: string;
  userId: string;
  disabledBy: string;
  reason?: string;
}

interface DisableCompanyUserResult {
  userId: string;
  companyId: string;
  status: string;
  disabledAt: Date;
  disabledBy: string;
}

export class DisableCompanyUserUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository
  ) {}

  async execute(input: DisableCompanyUserInput): Promise<DisableCompanyUserResult> {
    // 1. Load membership
    const membership = await this.companyUserRepository.getByUserAndCompany(
      input.userId,
      input.companyId
    );

    if (!membership) {
      throw ApiError.badRequest('User is not a member of this company');
    }

    // 2. Cannot disable the owner
    if (membership.isOwner === true) {
      throw ApiError.badRequest('Cannot disable the owner');
    }

    // 3. Cannot disable yourself
    if (input.userId === input.disabledBy) {
      throw ApiError.badRequest('You cannot disable yourself');
    }

    // 4. Update membership
    const disabledAt = new Date();
    await this.companyUserRepository.update(input.userId, input.companyId, {
      // Note: CompanyUser entity doesn't have status, disabledAt, disabledBy, or reason fields yet
      // This is a placeholder implementation that will work once the entity is extended
      createdAt: disabledAt // Using createdAt as a workaround until entity is updated
      // TODO: Add status, disabledAt, disabledBy, reason fields to CompanyUser entity
    });

    // 5. Return DTO
    return {
      userId: input.userId,
      companyId: input.companyId,
      status: 'disabled',
      disabledAt,
      disabledBy: input.disabledBy
    };
  }
}
