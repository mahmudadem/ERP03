export interface CompanyModuleSettings {
  [key: string]: any;
}

export interface ICompanyModuleSettingsRepository {
  getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null>;
  saveSettings(companyId: string, moduleId: string, settings: CompanyModuleSettings, userId: string): Promise<void>;
  ensureModuleIsActivated(companyId: string, moduleId: string): Promise<void>;
}
