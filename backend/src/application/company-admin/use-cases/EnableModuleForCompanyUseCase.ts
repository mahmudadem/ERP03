/**
 * EnableModuleForCompanyUseCase
 * Enables a module for the company (if allowed by bundle)
 */

import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export class EnableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) {}

  async execute(input: any): Promise<any> {
    // TODO: Implement enable module logic
    // 1. Verify enabler has permission
    // 2. Load company via companyRepository.findById()
    // 3. Get company's bundle via getBundleById(company.bundleId)
    // 4. Verify module is in bundle's allowed modules
    // 5. Add module to company.modules array
    // 6. Save via companyRepository.enableModule()
    // 7. Return updated module list
    
    throw new Error('Not implemented');
  }
}
