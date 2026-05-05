import { Firestore } from 'firebase-admin/firestore';
import { IAiSettingsRepository } from '../../../../repository/interfaces/ai-assistant/IAiSettingsRepository';
import { AiProviderConfig } from '../../../../domain/ai-assistant/entities/AiProviderConfig';

/**
 * FirestoreAiSettingsRepository
 *
 * Stores AI provider config under:
 *   companies/{companyId}/ai-assistant/Settings/provider_config
 */
export class FirestoreAiSettingsRepository implements IAiSettingsRepository {
  constructor(private readonly db: Firestore) {}

  private getSettingsRef(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai-assistant').doc('Settings');
  }

  async getConfig(companyId: string): Promise<AiProviderConfig | null> {
    const doc = await this.getSettingsRef(companyId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data?.providerConfig) return null;

    return AiProviderConfig.fromJSON(data.providerConfig);
  }

  async saveConfig(config: AiProviderConfig): Promise<void> {
    const ref = this.getSettingsRef(config.companyId);
    await ref.set({
      providerConfig: config.toPersistenceJSON(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
}