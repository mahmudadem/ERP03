/**
 * DeleteCompanyUserUseCase.ts
 * 
 * Purpose: Removes a user from the company (deletes the membership record).
 */

import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';

export interface DeleteCompanyUserInput {
  companyId: string;
  userId: string;
}

export class DeleteCompanyUserUseCase {
  constructor(private companyUserRepository: ICompanyUserRepository) {}

  async execute(input: DeleteCompanyUserInput): Promise<void> {
    await this.companyUserRepository.delete(input.companyId, input.userId);
  }
}
