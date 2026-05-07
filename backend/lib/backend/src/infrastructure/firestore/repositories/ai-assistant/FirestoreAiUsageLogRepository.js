"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiUsageLogRepository = void 0;
const AiUsageLog_1 = require("../../../../domain/ai-assistant/entities/AiUsageLog");
/**
 * FirestoreAiUsageLogRepository
 *
 * Stores usage logs under:
 *   companies/{companyId}/ai-assistant/Data/usage_logs/{logId}
 */
class FirestoreAiUsageLogRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db
            .collection('companies').doc(companyId)
            .collection('ai-assistant').doc('Data')
            .collection('usage_logs');
    }
    async create(log) {
        const docRef = this.getCollection(log.companyId).doc(log.id);
        await docRef.set(log.toJSON());
        return log;
    }
    async getByCompany(companyId, limit = 50, offset = 0) {
        const snapshot = await this.getCollection(companyId)
            .orderBy('createdAt', 'desc')
            .offset(offset)
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => AiUsageLog_1.AiUsageLog.fromJSON(doc.data()));
    }
    async countTodayByCompany(companyId) {
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const startOfDayStr = startOfDay.toISOString();
        const snapshot = await this.getCollection(companyId)
            .where('createdAt', '>=', startOfDayStr)
            .get();
        return snapshot.size;
    }
    async countTodayByUser(companyId, userId) {
        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const startOfDayStr = startOfDay.toISOString();
        const snapshot = await this.getCollection(companyId)
            .where('createdAt', '>=', startOfDayStr)
            .where('userId', '==', userId)
            .get();
        return snapshot.size;
    }
    async getByUser(companyId, userId, limit = 50) {
        const snapshot = await this.getCollection(companyId)
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => AiUsageLog_1.AiUsageLog.fromJSON(doc.data()));
    }
}
exports.FirestoreAiUsageLogRepository = FirestoreAiUsageLogRepository;
//# sourceMappingURL=FirestoreAiUsageLogRepository.js.map