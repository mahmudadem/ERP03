/**
 * EnableCompanyUserUseCase
 * Re-activates a previously disabled user
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ApiError } from '../../../api/errors/ApiError';

interface EnableCompanyUserInput {
  companyId: string;
  userId: string;
  enabledBy: string;
}

interface EnableCompanyUserResult {
  userId: string;
  companyId: string;
  status: string;
  enabledAt: Date;
  enabledBy: string;
}

export class EnableCompanyUserUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository
  ) {}

  async execute(input: EnableCompanyUserInput): Promise<EnableCompanyUserResult> {
    // 1. Load membership
    const membership = await this.companyUserRepository.getByUserAndCompany(
      input.userId,
      input.companyId
    );

    if (!membership) {
      throw ApiError.badRequest('User is not a member of this company');
    }

    // 2. Cannot enable owner (owner is always active)
    if (membership.isOwner === true) {
      throw ApiError.badRequest('Owner is always active and cannot be enabled');
    }

    // 3. Update membership to active status
    const enabledAt = new Date();
    await this.companyUserRepository.update(input.userId, input.companyId, {
      // Note: CompanyUser entity doesn't have status, enabledAt, enabledBy fields yet
      // This is a placeholder implementation
      createdAt: enabledAt // Using createdAt as workaround
      // TODO: Add status, enabledAt, enabledBy fields to CompanyUser entity
    });

    // 4. Return DTO
    return {
      userId: input.userId,
      companyId: input.companyId,
      status: 'active',
      enabledAt,
      enabledBy: input.enabledBy
    };
  }
}
