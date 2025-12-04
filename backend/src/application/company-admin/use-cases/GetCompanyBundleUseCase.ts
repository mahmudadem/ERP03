import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { BUNDLES } from '../../../domain/platform/Bundle';
import { ApiError } from '../../../api/errors/ApiError';

export class GetCompanyBundleUseCase {
    constructor(private companyRepository: ICompanyRepository) { }

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
        const bundleId = company.subscriptionPlan || 'starter';

        // Load bundle metadata from Bundles registry
        const bundle = BUNDLES.find(b => b.id === bundleId);

        if (!bundle) {
            // Fallback to starter if bundle not found
            const starterBundle = BUNDLES.find(b => b.id === 'starter');
            return {
                bundleId: 'starter',
                ...starterBundle
            };
        }

        // Return
        return {
            bundleId: bundle.id,
            ...bundle
        };
    }
}
