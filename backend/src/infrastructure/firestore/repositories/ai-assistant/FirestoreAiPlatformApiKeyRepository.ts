import { Firestore } from 'firebase-admin/firestore';
import { AiPlatformApiKey } from '../../../../domain/ai-assistant/entities/AiPlatformApiKey';
import { IAiPlatformApiKeyRepository } from '../../../../repository/interfaces/ai-assistant/IAiPlatformApiKeyRepository';

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
};

export class FirestoreAiPlatformApiKeyRepository implements IAiPlatformApiKeyRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db
      .collection('system_metadata')
      .doc('ai_api_keys')
      .collection('items');
  }

  async getById(id: string): Promise<AiPlatformApiKey | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return AiPlatformApiKey.fromJSON(doc.data()!);
  }

  async list(): Promise<AiPlatformApiKey[]> {
    const snap = await this.getCollection().get();
    return snap.docs.map(d => AiPlatformApiKey.fromJSON(d.data()));
  }

  async listByProvider(providerId: string): Promise<AiPlatformApiKey[]> {
    const snap = await this.getCollection().where('providerId', '==', providerId).get();
    return snap.docs.map(d => AiPlatformApiKey.fromJSON(d.data()));
  }

  async save(key: AiPlatformApiKey): Promise<void> {
    await this.getCollection().doc(key.id).set(stripUndefined(key.toPersistenceJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
