import { CommunicationsSettings } from '../../../domain/communications/CommunicationsSettings';

export interface ICommunicationsSettingsRepository {
  getSettings(companyId: string): Promise<CommunicationsSettings | null>;
  saveSettings(settings: CommunicationsSettings): Promise<void>;
}
