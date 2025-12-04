export interface CompanyModuleSettings {
  [key: string]: any;
}

export interface ICompanyModuleSettingsRepository {
  findByCompanyId(companyId: string): Promise<any[]>;
  create(settings: any): Promise<void>;
  update(companyId: string, moduleId: string, settings: any): Promise<void>;
  getSettings(companyId: string, moduleId: string): Promise<CompanyModuleSettings | null>;
  saveSettings(companyId: string, moduleId: string, settings: CompanyModuleSettings, userId: string): Promise<void>;
  ensureModuleIsActivated(companyId: string, moduleId: string): Promise<void>;
}
