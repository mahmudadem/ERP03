/**
 * EnableCompanyUserUseCase
 * Re-activates a previously disabled user
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ApiError } from '../../../api/errors/ApiError';

interface EnableCompanyUserInput {
  companyId: string;
  userId: string;
}

export class EnableCompanyUserUseCase {
  constructor(
    private companyUserRepository: ICompanyUserRepository
  ) { }

  async execute(input: EnableCompanyUserInput): Promise<any> {
    // Validate
    if (!input.companyId || !input.userId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load membership
    const membership = await this.companyUserRepository.get(input.companyId, input.userId);
    if (!membership) {
      throw ApiError.notFound("User not found in company");
    }

    // Update state
    await this.companyUserRepository.update(input.userId, input.companyId, { isDisabled: false });

    // Return
    return { userId: input.userId, companyId: input.companyId, isDisabled: false };
  }
}
