/**
 * DisableModuleForCompanyUseCase
 * Disables a module for the company
 */

import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export class DisableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) {}

  async execute(input: any): Promise<any> {
    // TODO: Implement disable module logic
    // 1. Verify disabler has permission
    // 2. Load company via companyRepository.findById()
    // 3. Verify module is in company.modules
    // 4. Verify module is not mandatory
    // 5. Remove module from company.modules array
    // 6. Save via companyRepository.disableModule()
    // 7. Return updated module list
    
    throw new Error('Not implemented');
  }
}
