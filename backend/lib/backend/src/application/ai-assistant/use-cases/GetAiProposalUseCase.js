"use strict";
/**
 * GetAiProposalUseCase
 *
 * Gets a single proposal by ID.
 * Enforces company scope — rejects if proposal belongs to a different company.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetAiProposalUseCase = void 0;
class GetAiProposalUseCase {
    constructor(proposalRepository) {
        this.proposalRepository = proposalRepository;
    }
    async execute(input) {
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
exports.GetAiProposalUseCase = GetAiProposalUseCase;
//# sourceMappingURL=GetAiProposalUseCase.js.map