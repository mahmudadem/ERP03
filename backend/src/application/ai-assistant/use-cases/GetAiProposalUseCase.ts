/**
 * GetAiProposalUseCase
 *
 * Gets a single proposal by ID.
 * Enforces company scope — rejects if proposal belongs to a different company.
 */

import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';

export interface GetAiProposalInput {
  companyId: string;
  proposalId: string;
}

export interface GetAiProposalOutput {
  proposal: Record<string, unknown>;
}

export class GetAiProposalUseCase {
  constructor(private readonly proposalRepository: IAiProposalRepository) {}

  async execute(input: GetAiProposalInput): Promise<GetAiProposalOutput> {
    const proposal = await this.proposalRepository.getById(input.companyId, input.proposalId);

    if (!proposal) {
      throw new Error('GetAiProposal: proposal not found');
    }

    if (proposal.companyId !== input.companyId) {
      throw new Error('GetAiProposal: proposal does not belong to this company');
    }

    return {
      proposal: proposal.toJSON(),
    };
  }
}
