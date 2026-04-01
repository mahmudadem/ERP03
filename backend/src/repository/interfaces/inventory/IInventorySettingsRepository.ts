import { InventorySettings } from '../../../domain/inventory/entities/InventorySettings';

export interface IInventorySettingsRepository {
  getSettings(companyId: string): Promise<InventorySettings | null>;
  saveSettings(settings: InventorySettings): Promise<void>;
}
