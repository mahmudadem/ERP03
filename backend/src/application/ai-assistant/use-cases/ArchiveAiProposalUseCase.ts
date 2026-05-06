/**
 * ArchiveAiProposalUseCase
 *
 * Archives proposals. This is a soft operation — it only changes status.
 * No ERP data is deleted or modified.
 */

import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';

export interface ArchiveAiProposalInput {
  companyId: string;
  proposalId: string;
}

export interface ArchiveAiProposalOutput {
  proposal: Record<string, unknown>;
}

export class ArchiveAiProposalUseCase {
  constructor(private readonly proposalRepository: IAiProposalRepository) {}

  async execute(input: ArchiveAiProposalInput): Promise<ArchiveAiProposalOutput> {
    const proposal = await this.proposalRepository.getById(input.companyId, input.proposalId);

    if (!proposal) {
      throw new Error('ArchiveAiProposal: proposal not found');
    }

    if (proposal.companyId !== input.companyId) {
      throw new Error('ArchiveAiProposal: proposal does not belong to this company');
    }

    try {
      proposal.archive();
    } catch (err: any) {
      throw new Error(`ArchiveAiProposal: ${err.message}`);
    }

    await this.proposalRepository.update(proposal);

    return {
      proposal: proposal.toJSON(),
    };
  }
}
