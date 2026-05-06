import { Firestore, Timestamp } from 'firebase-admin/firestore';
import { IAiChatRepository } from '../../../../repository/interfaces/ai-assistant/IAiChatRepository';
import { AiChatMessage } from '../../../../domain/ai-assistant/entities/AiChatMessage';

const stripUndefinedDeep = (value: any): any => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }
  if (value instanceof Date || value instanceof Timestamp) {
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
 * FirestoreAiChatRepository
 *
 * Stores chat messages under:
 *   companies/{companyId}/ai-assistant/Data/chat_messages/{messageId}
 */
export class FirestoreAiChatRepository implements IAiChatRepository {
  constructor(private readonly db: Firestore) {}

  private getCollection(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai-assistant').doc('Data')
      .collection('chat_messages');
  }

  async create(message: AiChatMessage): Promise<AiChatMessage> {
    const docRef = this.getCollection(message.companyId).doc(message.id);
    await docRef.set(stripUndefinedDeep(message.toJSON()));
    return message;
  }

  async getConversationMessages(
    companyId: string,
    userId: string,
    conversationId: string,
    limit: number = 20
  ): Promise<AiChatMessage[]> {
    const snapshot = await this.getCollection(companyId)
      .where('userId', '==', userId)
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => AiChatMessage.fromJSON(doc.data()));
  }

  async getRecentConversations(
    companyId: string,
    userId: string,
    limit: number = 10
  ): Promise<AiChatMessage[]> {
    // Get latest message per conversation using a grouped query approach
    // Firestore doesn't support GROUP BY, so we get recent messages and deduplicate
    const snapshot = await this.getCollection(companyId)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit * 5) // Fetch more to deduplicate
      .get();

    const seen = new Set<string>();
    const latestMessages: AiChatMessage[] = [];

    for (const doc of snapshot.docs) {
      const message = AiChatMessage.fromJSON(doc.data());
      if (!seen.has(message.conversationId)) {
        seen.add(message.conversationId);
        latestMessages.push(message);
        if (latestMessages.length >= limit) break;
      }
    }

    return latestMessages;
  }

  async deleteConversation(
    companyId: string,
    userId: string,
    conversationId: string
  ): Promise<void> {
    const snapshot = await this.getCollection(companyId)
      .where('userId', '==', userId)
      .where('conversationId', '==', conversationId)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  async countToday(companyId: string): Promise<number> {
    // Get start of today (UTC)
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // createdAt is stored as an ISO string in toJSON(), so compare as string
    // Only count role='user' messages — each request creates 1 user + 1 assistant message,
    // but the rate limit is per request, not per message.
    const startOfDayStr = startOfDay.toISOString();

    const snapshot = await this.getCollection(companyId)
      .where('createdAt', '>=', startOfDayStr)
      .where('role', '==', 'user')
      .get();

    return snapshot.size;
  }
}
