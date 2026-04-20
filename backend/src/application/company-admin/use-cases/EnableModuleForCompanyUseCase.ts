import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ModuleRegistry } from '../../platform/ModuleRegistry';
import { ApiError } from '../../../api/errors/ApiError';
import { CompanyModuleEntity } from '../../../domain/company/entities/CompanyModule';

export class EnableModuleForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private companyModuleRepository: ICompanyModuleRepository
  ) { }

  async execute(input: { companyId: string; moduleName: string }): Promise<any> {
    // Validate companyId + moduleName
    const moduleName = String(input.moduleName || '').trim().toLowerCase();

    if (!input.companyId || !moduleName) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Confirm module exists in ModuleRegistry
    const module = ModuleRegistry.getInstance().getModule(moduleName);
    if (!module) {
      throw ApiError.badRequest("Invalid module");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // If already enabled → return early
    const normalizedModules = (company.modules || [])
      .map((m) => String(m || '').trim().toLowerCase())
      .filter(Boolean);

    if (normalizedModules.includes(moduleName)) {
      const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
      if (!moduleState) {
        await this.companyModuleRepository.create(CompanyModuleEntity.create(input.companyId, moduleName));
      } else if (moduleState.config?.isImplicit) {
        await this.companyModuleRepository.update(input.companyId, moduleName, {
          config: { ...moduleState.config, isImplicit: false },
          updatedAt: new Date(),
        });
      }

      return { moduleName, status: 'already_enabled' };
    }

    // Update company active modules list
    const newModules = Array.from(new Set([...normalizedModules, moduleName]));
    await this.companyRepository.update(input.companyId, { modules: newModules });

    // Ensure module-state record exists for initialization workflow
    const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
    if (!moduleState) {
      await this.companyModuleRepository.create(CompanyModuleEntity.create(input.companyId, moduleName));
    } else if (moduleState.config?.isImplicit) {
      await this.companyModuleRepository.update(input.companyId, moduleName, {
        config: { ...moduleState.config, isImplicit: false },
        updatedAt: new Date(),
      });
    }

    // Return success DTO
    return { moduleName, status: 'enabled' };
  }
}
