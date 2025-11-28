
import { CompanySettings } from '../../../domain/core/entities/CompanySettings';

export interface ICompanySettingsRepository {
  getSettings(companyId: string): Promise<CompanySettings>;
  updateSettings(companyId: string, settings: Partial<CompanySettings>): Promise<void>;
}
