import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class ListActiveCompanyModulesUseCase {
    constructor(
        private companyRepository: ICompanyRepository
    ) { }

    async execute(input: { companyId: string }): Promise<any[]> {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError.badRequest("Missing companyId");
        }

        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError.notFound("Company not found");
        }

        // Active modules array
        const active = company.modules || [];

        // Return enriched output
        return active.map(name => ({
            moduleName: name
        }));
    }
}
