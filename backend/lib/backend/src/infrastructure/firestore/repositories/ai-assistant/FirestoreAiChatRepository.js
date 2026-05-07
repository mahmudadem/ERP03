"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiChatRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const AiChatMessage_1 = require("../../../../domain/ai-assistant/entities/AiChatMessage");
const stripUndefinedDeep = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    if (Array.isArray(value)) {
        return value
            .map((item) => stripUndefinedDeep(item))
            .filter((item) => item !== undefined);
    }
    if (value instanceof Date || value instanceof firestore_1.Timestamp) {
        return value;
    }
    if (typeof value !== 'object') {
        return value;
    }
    const output = {};
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
class FirestoreAiChatRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db
            .collection('companies').doc(companyId)
            .collection('ai-assistant').doc('Data')
            .collection('chat_messages');
    }
    async create(message) {
        const docRef = this.getCollection(message.companyId).doc(message.id);
        await docRef.set(stripUndefinedDeep(message.toJSON()));
        return message;
    }
    async getConversationMessages(companyId, userId, conversationId, limit = 20) {
        const snapshot = await this.getCollection(companyId)
            .where('userId', '==', userId)
            .where('conversationId', '==', conversationId)
            .orderBy('createdAt', 'asc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => AiChatMessage_1.AiChatMessage.fromJSON(doc.data()));
    }
    async getRecentConversations(companyId, userId, limit = 10) {
        // Get latest message per conversation using a grouped query approach
        // Firestore doesn't support GROUP BY, so we get recent messages and deduplicate
        const snapshot = await this.getCollection(companyId)
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit * 5) // Fetch more to deduplicate
            .get();
        const seen = new Set();
        const latestMessages = [];
        for (const doc of snapshot.docs) {
            const message = AiChatMessage_1.AiChatMessage.fromJSON(doc.data());
            if (!seen.has(message.conversationId)) {
                seen.add(message.conversationId);
                latestMessages.push(message);
                if (latestMessages.length >= limit)
                    break;
            }
        }
        return latestMessages;
    }
    async deleteConversation(companyId, userId, conversationId) {
        const snapshot = await this.getCollection(companyId)
            .where('userId', '==', userId)
            .where('conversationId', '==', conversationId)
            .get();
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    async countToday(companyId) {
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
exports.FirestoreAiChatRepository = FirestoreAiChatRepository;
//# sourceMappingURL=FirestoreAiChatRepository.js.map