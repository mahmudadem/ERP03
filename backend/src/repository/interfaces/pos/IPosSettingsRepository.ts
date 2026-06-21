import { PosSettings } from '../../../domain/pos/entities/PosSettings';

/**
 * Persistence contract for company-level POS settings.
 * One row per company; identified by `companyId`.
 */
export interface IPosSettingsRepository {
  getSettings(companyId: string): Promise<PosSettings | null>;
  saveSettings(settings: PosSettings, tx?: unknown): Promise<void>;
}
