"use strict";
/**
 * FirestoreAiProposalRepository
 *
 * Stores AI proposals under:
 *   companies/{companyId}/ai-assistant/Data/proposals/{proposalId}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiProposalRepository = void 0;
const AiProposal_1 = require("../../../../domain/ai-assistant/entities/AiProposal");
class FirestoreAiProposalRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db
            .collection('companies').doc(companyId)
            .collection('ai-assistant').doc('Data')
            .collection('proposals');
    }
    async create(proposal) {
        const docRef = this.getCollection(proposal.companyId).doc(proposal.id);
        await docRef.set(proposal.toJSON());
        return proposal;
    }
    async getById(companyId, proposalId) {
        const doc = await this.getCollection(companyId).doc(proposalId).get();
        if (!doc.exists)
            return null;
        return AiProposal_1.AiProposal.fromJSON(doc.data());
    }
    async list(params) {
        let query = this.getCollection(params.companyId);
        if (params.type)
            query = query.where('type', '==', params.type);
        if (params.status)
            query = query.where('status', '==', params.status);
        if (params.moduleId)
            query = query.where('moduleId', '==', params.moduleId);
        if (params.userId)
            query = query.where('userId', '==', params.userId);
        query = query.orderBy('createdAt', 'desc');
        // For total count, we need a separate query
        const totalSnapshot = await query.get();
        const total = totalSnapshot.size;
        // Apply pagination
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        query = query.offset(offset).limit(limit);
        const snapshot = await query.get();
        const proposals = snapshot.docs.map((doc) => AiProposal_1.AiProposal.fromJSON(doc.data()));
        return { proposals, total };
    }
    async update(proposal) {
        const docRef = this.getCollection(proposal.companyId).doc(proposal.id);
        await docRef.set(proposal.toJSON(), { merge: true });
        return proposal;
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
    async archiveOlderThan(companyId, olderThan) {
        const olderThanStr = olderThan.toISOString();
        const snapshot = await this.getCollection(companyId)
            .where('createdAt', '<', olderThanStr)
            .where('status', '==', 'draft')
            .get();
        const batch = this.db.batch();
        let count = 0;
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'archived', updatedAt: new Date().toISOString() });
            count++;
        });
        if (count > 0)
            await batch.commit();
        return count;
    }
}
exports.FirestoreAiProposalRepository = FirestoreAiProposalRepository;
//# sourceMappingURL=FirestoreAiProposalRepository.js.map