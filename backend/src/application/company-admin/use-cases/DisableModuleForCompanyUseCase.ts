import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class DisableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    // Validate companyId + moduleName
    const moduleName = String(input.moduleName || '').trim().toLowerCase();
    if (!input.companyId || !moduleName) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // If module not active → throw error
    const normalizedModules = (company.modules || [])
      .map((m) => String(m || '').trim().toLowerCase())
      .filter(Boolean);

    if (!normalizedModules.includes(moduleName)) {
      throw ApiError.badRequest("Module is not enabled for this company");
    }

    // Ensure safe modules (DO NOT allow disabling "core" module)
    if (moduleName === 'core') {
      throw ApiError.forbidden("Cannot disable core module");
    }

    // Remove from list
    const newModules = normalizedModules.filter((m) => m !== moduleName);
    await this.companyRepository.update(input.companyId, { modules: newModules });

    // Return success DTO
    return { moduleName, status: 'disabled' };
  }
}
