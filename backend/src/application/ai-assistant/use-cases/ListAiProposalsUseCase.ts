/**
 * ListAiProposalsUseCase
 *
 * Lists proposals for a company with filters.
 * Company-scoped — users can only see proposals from their own company.
 */

import { IAiProposalRepository } from '../../../repository/interfaces/ai-assistant/IAiProposalRepository';
import { AiProposal } from '../../../domain/ai-assistant/entities/AiProposal';

export interface ListAiProposalsInput {
  companyId: string;
  type?: string;
  status?: string;
  moduleId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface ListAiProposalsOutput {
  proposals: Record<string, unknown>[];
  total: number;
}

export class ListAiProposalsUseCase {
  constructor(private readonly proposalRepository: IAiProposalRepository) {}

  async execute(input: ListAiProposalsInput): Promise<ListAiProposalsOutput> {
    const result = await this.proposalRepository.list({
      companyId: input.companyId,
      type: input.type,
      status: input.status,
      moduleId: input.moduleId,
      userId: input.userId,
      limit: input.limit || 20,
      offset: input.offset || 0,
    });

    return {
      proposals: result.proposals.map((p: AiProposal) => p.toJSON()),
      total: result.total,
    };
  }
}
