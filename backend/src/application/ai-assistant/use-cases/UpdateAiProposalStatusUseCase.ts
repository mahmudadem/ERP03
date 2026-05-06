/**
 * UpdateAiProposalStatusUseCase
 *
 * Updates the status of an AI proposal (accept, reject, submit for review).
 * IMPORTANT: Accepting a proposal does NOT execute any business action.
 * It only marks the proposal as reviewed/accepted in the sandbox.
 */

import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';
import { IAiProposalPolicyRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalPolicyRepository';
import { AiProposal, AiProposalStatus } from '../../../domain/ai-assistant/entities/AiProposal';

export interface UpdateAiProposalStatusInput {
  companyId: string;
  proposalId: string;
  newStatus: AiProposalStatus;
  reviewedBy: string;
  rejectionReason?: string;
}

export interface UpdateAiProposalStatusOutput {
  proposal: Record<string, unknown>;
  notice: string;
}

export class UpdateAiProposalStatusUseCase {
  constructor(
    private readonly proposalRepository: IAiProposalRepository,
    private readonly policyRepository: IAiProposalPolicyRepository,
  ) {}

  async execute(input: UpdateAiProposalStatusInput): Promise<UpdateAiProposalStatusOutput> {
    // 1. Get the proposal
    const proposal = await this.proposalRepository.getById(input.companyId, input.proposalId);

    if (!proposal) {
      throw new Error('UpdateAiProposalStatus: proposal not found');
    }

    if (proposal.companyId !== input.companyId) {
      throw new Error('UpdateAiProposalStatus: proposal does not belong to this company');
    }

    // 2. If accepting, verify policy allows (requireReview check)
    if (input.newStatus === 'accepted') {
      const policy = await this.policyRepository.getCompanyPolicy(input.companyId);

      if (policy.requireReview && proposal.status !== 'pending_review') {
        throw new Error('UpdateAiProposalStatus: proposal must be in pending_review status before acceptance');
      }

      // SAFETY: Accepting NEVER executes business action
      // This is enforced at the entity level and here we add the notice
    }

    // 3. Transition status
    let notice: string;

    try {
      if (input.newStatus === 'accepted') {
        proposal.accept(input.reviewedBy);
        notice = 'Proposal marked as accepted. No ERP data was changed. Accepting a proposal does NOT create real records.';
      } else if (input.newStatus === 'rejected') {
        proposal.reject(input.reviewedBy, input.rejectionReason);
        notice = 'Proposal rejected.';
      } else if (input.newStatus === 'archived') {
        proposal.archive();
        notice = 'Proposal archived.';
      } else if (input.newStatus === 'pending_review') {
        proposal.submitForReview();
        notice = 'Proposal submitted for review.';
      } else {
        proposal.transitionTo(input.newStatus, input.reviewedBy, input.rejectionReason);
        notice = `Proposal status updated to ${input.newStatus}.`;
      }
    } catch (err: any) {
      throw new Error(`UpdateAiProposalStatus: ${err.message}`);
    }

    // 4. Persist
    await this.proposalRepository.update(proposal);

    return {
      proposal: proposal.toJSON(),
      notice,
    };
  }
}
