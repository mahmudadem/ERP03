import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
// Assuming we have a Bundle entity or similar. For now, we'll return the bundle ID or object.
// If Bundle entity doesn't exist, we might need to define it or use a generic type.
// Let's assume we return the bundle ID string for now as per Company entity.

export class GetCompanyBundleUseCase {
    constructor(private companyRepository: ICompanyRepository) { }

    async execute(companyId: string): Promise<any> {
        const company = await this.companyRepository.findById(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        // In a real system, we would fetch the full Bundle object from a BundleRepository using company.bundleId
        // For MVP, we'll return the bundleId and maybe some mock details or just the ID.
        return {
            bundleId: company.subscriptionPlan || 'free', // Assuming subscriptionPlan holds the bundle ID
            // Add more details if available
        };
    }
}
