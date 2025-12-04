import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';

export class DisableModuleForCompanyUseCase {
  constructor(
    private companyModuleSettingsRepository: ICompanyModuleSettingsRepository
  ) { }

  async execute(companyId: string, moduleId: string): Promise<void> {
    // 1. Check if settings exist
    const settings = await this.companyModuleSettingsRepository.findByCompanyId(companyId);
    const moduleSettings = settings.find(s => s.moduleId === moduleId);

    if (moduleSettings && moduleSettings.isEnabled) {
      // 2. Update to disabled
      await this.companyModuleSettingsRepository.update(companyId, moduleId, { isEnabled: false });
    }
    // If not found or already disabled, do nothing
  }
}
