import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ModuleRegistry } from '../../platform/ModuleRegistry';
import { ApiError } from '../../../api/errors/ApiError';

export class EnableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    // Validate companyId + moduleName
    if (!input.companyId || !input.moduleName) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Confirm module exists in ModuleRegistry
    const module = ModuleRegistry.getInstance().getModule(input.moduleName);
    if (!module) {
      throw ApiError.badRequest("Invalid module");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // If already enabled → return early
    if (company.modules && company.modules.includes(input.moduleName)) {
      return { moduleName: input.moduleName, status: 'already_enabled' };
    }

    // Update
    const newModules = [...(company.modules || []), input.moduleName];
    await this.companyRepository.update(input.companyId, { modules: newModules });

    // Return success DTO
    return { moduleName: input.moduleName, status: 'enabled' };
  }
}
