/**
 * DisableCompanyUserUseCase
 * Disables a user's access to the company (soft delete)
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ApiError } from '../../../api/errors/ApiError';

interface DisableCompanyUserInput {
  companyId: string;
  userId: string;
}

export class DisableCompanyUserUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository
  ) { }

  async execute(input: DisableCompanyUserInput): Promise<any> {
    // Validate
    if (!input.companyId || !input.userId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load membership
    const membership = await this.companyUserRepository.get(input.companyId, input.userId);
    if (!membership) {
      throw ApiError.notFound("User not found in company");
    }

    // Block owner
    if (membership.isOwner) {
      throw ApiError.forbidden("Owner cannot be disabled");
    }

    // Update state
    await this.companyUserRepository.update(input.userId, input.companyId, { isDisabled: true });

    // Return
    return { userId: input.userId, companyId: input.companyId, isDisabled: true };
  }
}
