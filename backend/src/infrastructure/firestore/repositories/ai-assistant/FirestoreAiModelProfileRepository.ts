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
    try {
      if (!id) return null;
      // Firestore document paths must have an even number of components.
      // If an ID contains a slash, Firestore thinks it's a subpath.
      // IDs should be encoded, but we catch errors here to prevent crashes from legacy unencoded data.
      const doc = await this.getCollection().doc(id).get();
      if (!doc.exists) return null;
      return AiModelProfile.fromJSON(doc.data()!);
    } catch (error) {
      console.warn(`[FirestoreAiModelProfileRepository] Failed to get profile by ID '${id}': ${(error as Error).message}`);
      return null;
    }
  }

  async getByProviderAndModel(provider: string, modelName: string, tenantId?: string): Promise<AiModelProfile | null> {
    if (tenantId) {
      const profiles = await this.list({ tenantId, scope: 'TENANT' });
      return profiles.find(p => p.provider === provider && p.modelId === modelName) || null;
    }
    return this.getById(AiModelProfile.makeId(provider, modelName));
  }

  async list(filters?: { tenantId?: string; scope?: 'GLOBAL' | 'TENANT' }): Promise<AiModelProfile[]> {
    let query: FirebaseFirestore.Query = this.getCollection();
    if (filters?.scope) {
      query = query.where('scope', '==', filters.scope);
    }
    if (filters?.tenantId) {
      query = query.where('tenantId', '==', filters.tenantId);
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => AiModelProfile.fromJSON(doc.data()!));
  }

  async save(profile: AiModelProfile): Promise<void> {
    await this.getCollection().doc(profile.id).set(stripUndefined(profile.toJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
