import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ApiError } from '../../../api/errors/ApiError';
import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';

export class ListActiveCompanyModulesUseCase {
    constructor(
        private companyRepository: ICompanyRepository,
        private companyModuleRepository?: ICompanyModuleRepository
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

        if (this.companyModuleRepository) {
            const moduleStates = await this.companyModuleRepository.listByCompany(input.companyId);
            if (moduleStates.length > 0) {
                return moduleStates
                    .filter((moduleState) => moduleState.isEnabled)
                    .map((moduleState) => moduleState.moduleCode);
            }
        }

        // Legacy fallback for companies not yet backfilled to CompanyModule.
        const active = company.modules || [];

        // Return plain string array of active module IDs
        return active;
    }
}
