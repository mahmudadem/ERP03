import { Firestore } from 'firebase-admin/firestore';
import { AiModelCertificationResult } from '../../../../domain/ai-assistant/entities/AiModelCertificationResult';
import {
  CertificationLookupInput,
  IAiModelCertificationRepository,
} from '../../../../repository/interfaces/ai-assistant/IAiModelCertificationRepository';

const stripUndefined = (data: Record<string, unknown>): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) clean[key] = value;
  }
  return clean;
};

export class FirestoreAiModelCertificationRepository implements IAiModelCertificationRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_model_certifications').collection('results');
  }

  async getById(id: string): Promise<AiModelCertificationResult | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return AiModelCertificationResult.fromJSON(doc.data()!);
  }

  async list(filters?: {
    scope?: 'GLOBAL' | 'TENANT';
    tenantId?: string;
    category?: any;
    moduleId?: string;
  }): Promise<AiModelCertificationResult[]> {
    let query: FirebaseFirestore.Query = this.getCollection();
    if (filters?.scope) query = query.where('scope', '==', filters.scope);
    if (filters?.tenantId) query = query.where('tenantId', '==', filters.tenantId);
    if (filters?.category) query = query.where('category', '==', filters.category);
    if (filters?.moduleId) query = query.where('moduleId', '==', filters.moduleId);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => AiModelCertificationResult.fromJSON(doc.data()!));
  }

  async listByModelProfile(modelProfileId: string): Promise<AiModelCertificationResult[]> {
    const snapshot = await this.getCollection()
      .where('modelProfileId', '==', modelProfileId)
      .get();
    return snapshot.docs.map(doc => AiModelCertificationResult.fromJSON(doc.data()!));
  }

  async findValidForRouting(input: CertificationLookupInput): Promise<AiModelCertificationResult | null> {
    const snapshot = await this.getCollection()
      .where('modelProfileId', '==', input.modelProfileId)
      .where('profileHash', '==', input.profileHash)
      .where('category', '==', input.category)
      .where('toolContractVersion', '==', input.toolContractVersion)
      .where('dataFilterPolicyVersion', '==', input.dataFilterPolicyVersion)
      .get();

    const candidates = snapshot.docs
      .map(doc => AiModelCertificationResult.fromJSON(doc.data()!))
      .filter(result => result.status === 'CERTIFIED')
      .filter(result => result.appliesToTenant(input.tenantId))
      .filter(result => !input.moduleId || !result.moduleId || result.moduleId === input.moduleId)
      .filter(result => !input.skillId || !result.skillId || result.skillId === input.skillId)
      .sort((a, b) => {
        if (a.scope !== b.scope) return a.scope === 'TENANT' ? -1 : 1;
        return b.testedAt.getTime() - a.testedAt.getTime();
      });

    return candidates[0] ?? null;
  }

  async save(result: AiModelCertificationResult): Promise<void> {
    await this.getCollection().doc(result.id).set(stripUndefined(result.toJSON()));
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
