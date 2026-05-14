import { Firestore } from 'firebase-admin/firestore';
import { IAiConversationMetaRepository, AiConversationMeta } from '../../../../repository/interfaces/ai-assistant/IAiConversationMetaRepository';

/**
 * Strips undefined values recursively so Firestore doesn't reject them.
 */
const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== 'object') {
    return value;
  }

  const output: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    const normalized = stripUndefinedDeep(entry);
    if (normalized !== undefined) {
      output[key] = normalized;
    }
  });

  return output;
};

/**
 * FirestoreAiConversationMetaRepository
 *
 * Stores conversation metadata as one document per conversation under:
 *   companies/{companyId}/ai_conversation_meta/{conversationId}
 *
 * This enables fast listing of conversations with titles, message counts,
 * and timestamps without scanning all chat messages.
 */
export class FirestoreAiConversationMetaRepository implements IAiConversationMetaRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai_conversation_meta');
  }

  async get(conversationId: string, companyId: string): Promise<AiConversationMeta | null> {
    const doc = await this.getCollection(companyId).doc(conversationId).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (!data) return null;
    return FirestoreAiConversationMetaRepository.fromDoc(conversationId, data);
  }

  async listByUser(companyId: string, userId: string, limit: number = 20): Promise<AiConversationMeta[]> {
    const snapshot = await this.getCollection(companyId)
      .where('userId', '==', userId)
      .orderBy('lastMessageAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc =>
      FirestoreAiConversationMetaRepository.fromDoc(doc.id, doc.data()!),
    );
  }

  async save(meta: AiConversationMeta): Promise<void> {
    const docRef = this.getCollection(meta.companyId).doc(meta.id);
    const data = stripUndefinedDeep(FirestoreAiConversationMetaRepository.toDoc(meta));
    await docRef.set(data, { merge: true });
  }

  async delete(conversationId: string, companyId: string): Promise<void> {
    await this.getCollection(companyId).doc(conversationId).delete();
  }

  async listByCompany(companyId: string, limit: number = 100): Promise<AiConversationMeta[]> {
    const snapshot = await this.getCollection(companyId)
      .orderBy('lastMessageAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc =>
      FirestoreAiConversationMetaRepository.fromDoc(doc.id, doc.data()!),
    );
  }

  // ── Serialization helpers ──────────────────────────────────────────

  private static toDoc(meta: AiConversationMeta): Record<string, unknown> {
    return {
      companyId: meta.companyId,
      userId: meta.userId,
      title: meta.title,
      messageCount: meta.messageCount,
      lastMessageAt: meta.lastMessageAt.toISOString(),
      createdAt: meta.createdAt.toISOString(),
    };
  }

  private static fromDoc(id: string, data: Record<string, any>): AiConversationMeta {
    return {
      id,
      companyId: data.companyId,
      userId: data.userId,
      title: data.title || '',
      messageCount: data.messageCount || 0,
      lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(data.lastMessageAt),
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    };
  }
}