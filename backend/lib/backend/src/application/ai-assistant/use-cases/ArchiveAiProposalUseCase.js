"use strict";
/**
 * ArchiveAiProposalUseCase
 *
 * Archives proposals. This is a soft operation — it only changes status.
 * No ERP data is deleted or modified.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveAiProposalUseCase = void 0;
class ArchiveAiProposalUseCase {
    constructor(proposalRepository) {
        this.proposalRepository = proposalRepository;
    }
    async execute(input) {
        const proposal = await this.proposalRepository.getById(input.companyId, input.proposalId);
        if (!proposal) {
            throw new Error('ArchiveAiProposal: proposal not found');
        }
        if (proposal.companyId !== input.companyId) {
            throw new Error('ArchiveAiProposal: proposal does not belong to this company');
        }
        try {
            proposal.archive();
        }
        catch (err) {
            throw new Error(`ArchiveAiProposal: ${err.message}`);
        }
        await this.proposalRepository.update(proposal);
        return {
            proposal: proposal.toJSON(),
        };
    }
}
exports.ArchiveAiProposalUseCase = ArchiveAiProposalUseCase;
//# sourceMappingURL=ArchiveAiProposalUseCase.js.map