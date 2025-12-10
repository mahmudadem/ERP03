import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class GetCompanyBundleUseCase {
    constructor(
        private companyRepository: ICompanyRepository,
        private bundleRepo: IBundleRegistryRepository
    ) { }

    async execute(input: { companyId: string }): Promise<any> {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError.badRequest("Missing companyId");
        }

        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError.notFound("Company not found");
        }

        // Bundle value is stored in company.subscriptionPlan
        const bundleId = company.subscriptionPlan;

        if (!bundleId) {
            return null;
        }

        // Load bundle metadata from Firestore
        const bundle = await this.bundleRepo.getById(bundleId);

        if (!bundle) {
            // Bundle not found
            return null;
        }

        // Return
        return {
            bundleId: bundle.id,
            ...bundle
        };
    }
}
