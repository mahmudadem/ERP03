"use strict";
/**
 * ListAiProposalsUseCase
 *
 * Lists proposals for a company with filters.
 * Company-scoped — users can only see proposals from their own company.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAiProposalsUseCase = void 0;
class ListAiProposalsUseCase {
    constructor(proposalRepository) {
        this.proposalRepository = proposalRepository;
    }
    async execute(input) {
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
            proposals: result.proposals.map((p) => p.toJSON()),
            total: result.total,
        };
    }
}
exports.ListAiProposalsUseCase = ListAiProposalsUseCase;
//# sourceMappingURL=ListAiProposalsUseCase.js.map