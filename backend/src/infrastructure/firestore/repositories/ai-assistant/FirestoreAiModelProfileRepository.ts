import { Firestore } from 'firebase-admin/firestore';
import { AiModelProfile } from '../../../../domain/ai-assistant/entities/AiModelProfile';
import { IAiModelProfileRepository } from '../../../../repository/interfaces/ai-assistant/IAiModelProfileRepository';

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
};

export class FirestoreAiModelProfileRepository implements IAiModelProfileRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_model_profiles').collection('catalog');
  }

  async getById(id: string): Promise<AiModelProfile | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return AiModelProfile.fromJSON(doc.data()!);
  }

  async getByProviderAndModel(provider: string, modelName: string): Promise<AiModelProfile | null> {
    return this.getById(AiModelProfile.makeId(provider, modelName));
  }

  async list(): Promise<AiModelProfile[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiModelProfile.fromJSON(doc.data()!));
  }

  async save(profile: AiModelProfile): Promise<void> {
    await this.getCollection().doc(profile.id).set(stripUndefined(profile.toJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
