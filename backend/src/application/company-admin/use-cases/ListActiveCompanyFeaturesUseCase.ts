import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class ListActiveCompanyFeaturesUseCase {
    constructor(private companyRepository: ICompanyRepository) { }

    async execute(input: { companyId: string }): Promise<string[]> {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError.badRequest("Missing companyId");
        }

        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError.notFound("Company not found");
        }

        // Ensure company.features exists
        const active = (company as any).features ?? [];

        // Return
        return active;
    }
}
