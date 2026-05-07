"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiModelToolPolicyRepository = void 0;
const AiModelToolPolicy_1 = require("../../../../domain/ai-assistant/entities/AiModelToolPolicy");
/**
 * FirestoreAiModelToolPolicyRepository
 *
 * Stores per-provider/model tool policies under:
 *   system_metadata/ai_model_tool_policies/{policyId}
 *
 * Policies are platform-level — Super Admin manages them.
 */
class FirestoreAiModelToolPolicyRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection() {
        return this.db.collection('system_metadata').doc('ai_model_tool_policies').collection('policies');
    }
    async getById(policyId) {
        const doc = await this.getCollection().doc(policyId).get();
        if (!doc.exists)
            return null;
        return AiModelToolPolicy_1.AiModelToolPolicy.fromJSON(doc.data());
    }
    async list() {
        const snapshot = await this.getCollection().get();
        return snapshot.docs.map(doc => AiModelToolPolicy_1.AiModelToolPolicy.fromJSON(doc.data()));
    }
    async listByProvider(providerType) {
        const snapshot = await this.getCollection().where('providerType', '==', providerType).get();
        return snapshot.docs.map(doc => AiModelToolPolicy_1.AiModelToolPolicy.fromJSON(doc.data()));
    }
    async listByModel(model) {
        const snapshot = await this.getCollection().where('model', '==', model).get();
        return snapshot.docs.map(doc => AiModelToolPolicy_1.AiModelToolPolicy.fromJSON(doc.data()));
    }
    async save(policy) {
        await this.getCollection().doc(policy.id).set(policy.toJSON());
    }
    async delete(policyId) {
        await this.getCollection().doc(policyId).delete();
    }
}
exports.FirestoreAiModelToolPolicyRepository = FirestoreAiModelToolPolicyRepository;
//# sourceMappingURL=FirestoreAiModelToolPolicyRepository.js.map