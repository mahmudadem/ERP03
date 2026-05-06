import { Firestore } from 'firebase-admin/firestore';
import { IAiToolEnablementRepository } from '../../../../repository/interfaces/ai-assistant/IAiToolEnablementRepository';
import { AiToolEnablementPolicy } from '../../../../domain/ai-assistant/entities/AiToolEnablementPolicy';

/**
 * FirestoreAiToolEnablementRepository
 *
 * Stores tool enablement policies under:
 *   system_metadata/ai_tool_policies/{toolId}
 *
 * Policies are platform-level — Super Admin manages them.
 */
export class FirestoreAiToolEnablementRepository implements IAiToolEnablementRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('ai_tool_policies').collection('policies');
  }

  async getByToolId(toolId: string): Promise<AiToolEnablementPolicy | null> {
    const doc = await this.getCollection().doc(toolId).get();
    if (!doc.exists) return null;
    return AiToolEnablementPolicy.fromJSON(doc.data()!);
  }

  async list(): Promise<AiToolEnablementPolicy[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => AiToolEnablementPolicy.fromJSON(doc.data()!));
  }

  async listByToolIds(toolIds: string[]): Promise<AiToolEnablementPolicy[]> {
    if (toolIds.length === 0) return [];
    // Firestore 'in' queries support max 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < toolIds.length; i += 30) {
      chunks.push(toolIds.slice(i, i + 30));
    }
    const policies: AiToolEnablementPolicy[] = [];
    for (const chunk of chunks) {
      const snapshot = await this.getCollection().where('toolId', 'in', chunk).get();
      policies.push(...snapshot.docs.map(doc => AiToolEnablementPolicy.fromJSON(doc.data()!)));
    }
    return policies;
  }

  async save(policy: AiToolEnablementPolicy): Promise<void> {
    await this.getCollection().doc(policy.toolId).set(policy.toJSON());
  }

  async delete(toolId: string): Promise<void> {
    await this.getCollection().doc(toolId).delete();
  }
}