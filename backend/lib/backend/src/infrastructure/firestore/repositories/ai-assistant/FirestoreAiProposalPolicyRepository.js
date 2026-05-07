"use strict";
/**
 * FirestoreAiProposalPolicyRepository
 *
 * Global policy: system_metadata/ai_proposal_policies/global
 * Company policy: companies/{companyId}/ai-assistant/Data/proposal_policy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreAiProposalPolicyRepository = void 0;
const AiProposalPolicy_1 = require("../../../../domain/ai-assistant/entities/AiProposalPolicy");
class FirestoreAiProposalPolicyRepository {
    constructor(db) {
        this.db = db;
    }
    getGlobalDoc() {
        return this.db
            .collection('system_metadata').doc('ai_proposal_policies')
            .collection('policies').doc('global');
    }
    getCompanyDoc(companyId) {
        return this.db
            .collection('companies').doc(companyId)
            .collection('ai-assistant').doc('Data')
            .collection('proposal_policy').doc('policy');
    }
    async getGlobalPolicy() {
        const doc = await this.getGlobalDoc().get();
        if (!doc.exists) {
            return AiProposalPolicy_1.AiProposalPolicy.createGlobalDefault();
        }
        return AiProposalPolicy_1.AiProposalPolicy.fromJSON(doc.data());
    }
    async getCompanyPolicy(companyId) {
        const globalPolicy = await this.getGlobalPolicy();
        const doc = await this.getCompanyDoc(companyId).get();
        if (!doc.exists) {
            return globalPolicy; // No company override, use global defaults
        }
        const companyPolicy = AiProposalPolicy_1.AiProposalPolicy.fromJSON(doc.data());
        return companyPolicy.mergeWith(globalPolicy);
    }
    async saveGlobalPolicy(policy) {
        await this.getGlobalDoc().set(policy.toJSON());
        return policy;
    }
    async saveCompanyPolicy(policy) {
        if (!policy.companyId)
            throw new Error('Company policy must have a companyId');
        await this.getCompanyDoc(policy.companyId).set(policy.toJSON());
        return policy;
    }
    async listCompanyPolicies() {
        // Query all company proposal policies
        const companiesSnapshot = await this.db
            .collection('companies').get();
        const policies = [];
        for (const companyDoc of companiesSnapshot.docs) {
            const policyDoc = await this.getCompanyDoc(companyDoc.id).get();
            if (policyDoc.exists) {
                policies.push(AiProposalPolicy_1.AiProposalPolicy.fromJSON(policyDoc.data()));
            }
        }
        return policies;
    }
}
exports.FirestoreAiProposalPolicyRepository = FirestoreAiProposalPolicyRepository;
//# sourceMappingURL=FirestoreAiProposalPolicyRepository.js.map