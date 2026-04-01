import { PurchaseSettings } from '../../../domain/purchases/entities/PurchaseSettings';

export interface IPurchaseSettingsRepository {
  getSettings(companyId: string): Promise<PurchaseSettings | null>;
  saveSettings(settings: PurchaseSettings): Promise<void>;
}
