/**
 * DeleteCompanyRoleUseCase
 * Deletes a custom company role
 */

import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';

export class DeleteCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository,
    private companyUserRepository: ICompanyUserRepository
  ) {}

  async execute(input: any): Promise<any> {
    // TODO: Implement delete role logic
    // 1. Verify deleter has permission
    // 2. Load role via companyRoleRepository.getById()
    // 3. Verify role is not "Owner"
    // 4. Check if any users have this role
    // 5. If users exist, return error
    // 6. Delete via companyRoleRepository.delete()
    // 7. Return confirmation
    
    throw new Error('Not implemented');
  }
}
