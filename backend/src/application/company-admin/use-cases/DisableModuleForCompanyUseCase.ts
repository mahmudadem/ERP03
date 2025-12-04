import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class DisableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    // Validate companyId + moduleName
    if (!input.companyId || !input.moduleName) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // If module not active → throw error
    if (!company.modules || !company.modules.includes(input.moduleName)) {
      throw ApiError.badRequest("Module is not enabled for this company");
    }

    // Ensure safe modules (DO NOT allow disabling "core" module)
    if (input.moduleName === 'core') {
      throw ApiError.forbidden("Cannot disable core module");
    }

    // Remove from list
    const newModules = company.modules.filter(m => m !== input.moduleName);
    await this.companyRepository.update(input.companyId, { modules: newModules });

    // Return success DTO
    return { moduleName: input.moduleName, status: 'disabled' };
  }
}
