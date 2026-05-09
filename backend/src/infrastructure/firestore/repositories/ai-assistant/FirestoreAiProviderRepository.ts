import { Firestore } from 'firebase-admin/firestore';
import { AiProvider } from '../../../../domain/ai-assistant/entities/AiProvider';
import { IAiProviderRepository } from '../../../../repository/interfaces/ai-assistant/IAiProviderRepository';

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
};

export class FirestoreAiProviderRepository implements IAiProviderRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_providers').collection('registry');
  }

  async getById(id: string): Promise<AiProvider | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return AiProvider.fromJSON(doc.data()!);
  }

  async list(): Promise<AiProvider[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiProvider.fromJSON(doc.data()!));
  }

  async save(provider: AiProvider): Promise<void> {
    await this.getCollection().doc(provider.id).set(stripUndefined(provider.toJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
