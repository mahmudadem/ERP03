/**
 * IAiProposalRepository - Repository Interface
 *
 * Storage for AI proposals in the sandbox.
 * Proposals are company-scoped and stored under:
 *   companies/{companyId}/ai-assistant/Data/proposals/{proposalId}
 *
 * Prisma-ready: All methods use domain entities or plain objects.
 * No Firestore-specific types leak through this interface.
 */

import { AiProposal } from '../../../domain/ai-assistant/entities/AiProposal';

export interface IAiProposalRepository {
  /**
   * Create a new proposal.
   */
  create(proposal: AiProposal): Promise<AiProposal>;

  /**
   * Get a proposal by ID. Must match companyId for tenant isolation.
   */
  getById(companyId: string, proposalId: string): Promise<AiProposal | null>;

  /**
   * List proposals for a company with optional filters.
   */
  list(params: {
    companyId: string;
    type?: string;
    status?: string;
    moduleId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ proposals: AiProposal[]; total: number }>;

  /**
   * Update a proposal (status transitions, etc.).
   */
  update(proposal: AiProposal): Promise<AiProposal>;

  /**
   * Count proposals created today for a company.
   */
  countTodayByCompany(companyId: string): Promise<number>;

  /**
   * Count proposals created today by a specific user.
   */
  countTodayByUser(companyId: string, userId: string): Promise<number>;

  /**
   * Archive proposals older than a given date.
   */
  archiveOlderThan(companyId: string, olderThan: Date): Promise<number>;
}
