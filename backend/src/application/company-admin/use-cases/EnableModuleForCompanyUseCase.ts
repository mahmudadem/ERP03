import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';

export class EnableModuleForCompanyUseCase {
  constructor(
    private companyModuleSettingsRepository: ICompanyModuleSettingsRepository
  ) { }

  async execute(companyId: string, moduleId: string): Promise<void> {
    // 1. Check if settings exist for this module
    const settings = await this.companyModuleSettingsRepository.findByCompanyId(companyId);
    const moduleSettings = settings.find(s => s.moduleId === moduleId);

    if (moduleSettings) {
      // 2. If exists, update to enabled
      if (!moduleSettings.isEnabled) {
        await this.companyModuleSettingsRepository.update(companyId, moduleId, { isEnabled: true });
      }
    } else {
      // 3. If not exists, create new settings
      await this.companyModuleSettingsRepository.create({
        companyId,
        moduleId,
        isEnabled: true,
        settings: {} // Default empty settings
      });
    }
  }
}
