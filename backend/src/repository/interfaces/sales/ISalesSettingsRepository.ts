import { SalesSettings } from '../../../domain/sales/entities/SalesSettings';

export interface ISalesSettingsRepository {
  getSettings(companyId: string): Promise<SalesSettings | null>;
  saveSettings(settings: SalesSettings): Promise<void>;
}
