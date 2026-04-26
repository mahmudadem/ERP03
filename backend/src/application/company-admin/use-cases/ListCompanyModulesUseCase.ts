/**
 * ListCompanyModulesUseCase
 *
 * Returns modules available for Company Admin to enable/disable.
 * Returns:
 * - AVAILABLE modules that are entitled
 * - SUSPENDED modules that are already enabled for the company
 *
 * DB-only, code-only, and other blocked states are excluded.
 */
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../platform/ModuleAvailabilityService';
import { ApiError } from '../../../api/errors/ApiError';

export class ListCompanyModulesUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private companyModuleRepository: ICompanyModuleRepository
  ) {}

  async execute(input: { companyId: string }): Promise<any[]> {
    if (!input.companyId) {
      throw ApiError.badRequest('Missing companyId');
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    const companyModuleStates = await this.companyModuleRepository.listByCompany(input.companyId);
    const enabledModuleIds = companyModuleStates.length > 0
      ? companyModuleStates
          .filter((moduleState) => moduleState.isEnabled)
          .map((moduleState) => moduleState.moduleCode)
      : Array.isArray((company as any)?.modules)
        ? (company as any).modules
        : [];

    const service = ModuleAvailabilityService.getInstance();
    const availableInfos = await service.getCompanyAdminAvailableModules(input.companyId, enabledModuleIds);

    return availableInfos.map((info) => ({
      id: info.moduleId,
      name: info.manifest?.name || info.dbRecord?.name || info.moduleId,
      description: info.manifest?.description || info.dbRecord?.description || '',
      version: info.manifest?.version || info.dbRecord?.version || '1.0.0',
      state: info.state,
      isAvailable: info.state === ModuleAvailabilityState.AVAILABLE,
      isEnabled: enabledModuleIds.map((m: string) => String(m || '').trim().toLowerCase()).includes(info.moduleId),
      enabled: enabledModuleIds.map((m: string) => String(m || '').trim().toLowerCase()).includes(info.moduleId),
      blockedReason: info.reason,
    }));
  }
}
