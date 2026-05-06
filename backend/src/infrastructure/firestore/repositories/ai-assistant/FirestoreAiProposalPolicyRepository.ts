/**
 * FirestoreAiProposalPolicyRepository
 *
 * Global policy: system_metadata/ai_proposal_policies/global
 * Company policy: companies/{companyId}/ai-assistant/Data/proposal_policy
 */

import { Firestore } from 'firebase-admin/firestore';
import { IAiProposalPolicyRepository } from '../../../../repository/interfaces/ai-assistant/IAiProposalPolicyRepository';
import { AiProposalPolicy } from '../../../../domain/ai-assistant/entities/AiProposalPolicy';

export class FirestoreAiProposalPolicyRepository implements IAiProposalPolicyRepository {
  constructor(private readonly db: Firestore) {}

  private getGlobalDoc() {
    return this.db
      .collection('system_metadata').doc('ai_proposal_policies')
      .collection('policies').doc('global');
  }

  private getCompanyDoc(companyId: string) {
    return this.db
      .collection('companies').doc(companyId)
      .collection('ai-assistant').doc('Data')
      .collection('proposal_policy').doc('policy');
  }

  async getGlobalPolicy(): Promise<AiProposalPolicy> {
    const doc = await this.getGlobalDoc().get();
    if (!doc.exists) {
      return AiProposalPolicy.createGlobalDefault();
    }
    return AiProposalPolicy.fromJSON(doc.data()!);
  }

  async getCompanyPolicy(companyId: string): Promise<AiProposalPolicy> {
    const globalPolicy = await this.getGlobalPolicy();
    const doc = await this.getCompanyDoc(companyId).get();

    if (!doc.exists) {
      return globalPolicy; // No company override, use global defaults
    }

    const companyPolicy = AiProposalPolicy.fromJSON(doc.data()!);
    return companyPolicy.mergeWith(globalPolicy);
  }

  async saveGlobalPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy> {
    await this.getGlobalDoc().set(policy.toJSON());
    return policy;
  }

  async saveCompanyPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy> {
    if (!policy.companyId) throw new Error('Company policy must have a companyId');
    await this.getCompanyDoc(policy.companyId).set(policy.toJSON());
    return policy;
  }

  async listCompanyPolicies(): Promise<AiProposalPolicy[]> {
    // Query all company proposal policies
    const companiesSnapshot = await this.db
      .collection('companies').get();

    const policies: AiProposalPolicy[] = [];
    for (const companyDoc of companiesSnapshot.docs) {
      const policyDoc = await this.getCompanyDoc(companyDoc.id).get();
      if (policyDoc.exists) {
        policies.push(AiProposalPolicy.fromJSON(policyDoc.data()!));
      }
    }

    return policies;
  }
}
