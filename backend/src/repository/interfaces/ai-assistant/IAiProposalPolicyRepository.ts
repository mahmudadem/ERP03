/**
 * IAiProposalPolicyRepository - Repository Interface
 *
 * Storage for AI proposal policies.
 * Global policy: system_metadata/ai_proposal_policies/global
 * Company policy: companies/{companyId}/ai-assistant/Data/proposal_policy
 *
 * Prisma-ready: All methods use domain entities.
 */

import { AiProposalPolicy } from '../../../domain/ai-assistant/entities/AiProposalPolicy';

export interface IAiProposalPolicyRepository {
  /**
   * Get the global default policy.
   */
  getGlobalPolicy(): Promise<AiProposalPolicy>;

  /**
   * Get the policy for a specific company (merged with global defaults).
   */
  getCompanyPolicy(companyId: string): Promise<AiProposalPolicy>;

  /**
   * Save/update the global policy.
   */
  saveGlobalPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy>;

  /**
   * Save/update a company policy override.
   */
  saveCompanyPolicy(policy: AiProposalPolicy): Promise<AiProposalPolicy>;

  /**
   * List all company policies.
   */
  listCompanyPolicies(): Promise<AiProposalPolicy[]>;
}
