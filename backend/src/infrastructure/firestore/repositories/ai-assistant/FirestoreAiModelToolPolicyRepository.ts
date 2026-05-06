import { Firestore } from 'firebase-admin/firestore';
import { IAiModelToolPolicyRepository } from '../../../../repository/interfaces/ai-assistant/IAiModelToolPolicyRepository';
import { AiModelToolPolicy } from '../../../../domain/ai-assistant/entities/AiModelToolPolicy';

/**
 * FirestoreAiModelToolPolicyRepository
 *
 * Stores per-provider/model tool policies under:
 *   system_metadata/ai_model_tool_policies/{policyId}
 *
 * Policies are platform-level — Super Admin manages them.
 */
export class FirestoreAiModelToolPolicyRepository implements IAiModelToolPolicyRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_model_tool_policies').collection('policies');
  }

  async getById(policyId: string): Promise<AiModelToolPolicy | null> {
    const doc = await this.getCollection().doc(policyId).get();
    if (!doc.exists) return null;
    return AiModelToolPolicy.fromJSON(doc.data()!);
  }

  async list(): Promise<AiModelToolPolicy[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiModelToolPolicy.fromJSON(doc.data()!));
  }

  async listByProvider(providerType: string): Promise<AiModelToolPolicy[]> {
    const snapshot = await this.getCollection().where('providerType', '==', providerType).get();
    return snapshot.docs.map(doc => AiModelToolPolicy.fromJSON(doc.data()!));
  }

  async listByModel(model: string): Promise<AiModelToolPolicy[]> {
    const snapshot = await this.getCollection().where('model', '==', model).get();
    return snapshot.docs.map(doc => AiModelToolPolicy.fromJSON(doc.data()!));
  }

  async save(policy: AiModelToolPolicy): Promise<void> {
    await this.getCollection().doc(policy.id).set(policy.toJSON());
  }

  async delete(policyId: string): Promise<void> {
    await this.getCollection().doc(policyId).delete();
  }
}