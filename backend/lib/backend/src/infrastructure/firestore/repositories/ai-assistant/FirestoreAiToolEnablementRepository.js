"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiToolEnablementRepository = void 0;
const AiToolEnablementPolicy_1 = require("../../../../domain/ai-assistant/entities/AiToolEnablementPolicy");
/**
 * FirestoreAiToolEnablementRepository
 *
 * Stores tool enablement policies under:
 *   system_metadata/ai_tool_policies/{toolId}
 *
 * Policies are platform-level — Super Admin manages them.
 */
class FirestoreAiToolEnablementRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection() {
        return this.db.collection('system_metadata').doc('ai_tool_policies').collection('policies');
    }
    async getByToolId(toolId) {
        const doc = await this.getCollection().doc(toolId).get();
        if (!doc.exists)
            return null;
        return AiToolEnablementPolicy_1.AiToolEnablementPolicy.fromJSON(doc.data());
    }
    async list() {
        const snapshot = await this.getCollection().get();
        return snapshot.docs.map(doc => AiToolEnablementPolicy_1.AiToolEnablementPolicy.fromJSON(doc.data()));
    }
    async listByToolIds(toolIds) {
        if (toolIds.length === 0)
            return [];
        // Firestore 'in' queries support max 30 items
        const chunks = [];
        for (let i = 0; i < toolIds.length; i += 30) {
            chunks.push(toolIds.slice(i, i + 30));
        }
        const policies = [];
        for (const chunk of chunks) {
            const snapshot = await this.getCollection().where('toolId', 'in', chunk).get();
            policies.push(...snapshot.docs.map(doc => AiToolEnablementPolicy_1.AiToolEnablementPolicy.fromJSON(doc.data())));
        }
        return policies;
    }
    async save(policy) {
        await this.getCollection().doc(policy.toolId).set(policy.toJSON());
    }
    async delete(toolId) {
        await this.getCollection().doc(toolId).delete();
    }
}
exports.FirestoreAiToolEnablementRepository = FirestoreAiToolEnablementRepository;
//# sourceMappingURL=FirestoreAiToolEnablementRepository.js.map