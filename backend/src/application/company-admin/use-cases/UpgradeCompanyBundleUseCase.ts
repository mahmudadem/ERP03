import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { IBundleRegistryRepository } from '../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class UpgradeCompanyBundleUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private bundleRepo: IBundleRegistryRepository
  ) { }

  async execute(input: { companyId: string; bundleId: string }): Promise<any> {
    // Validate companyId + bundleId
    if (!input.companyId || !input.bundleId) {
      throw ApiError.badRequest("Missing required fields");
    }

    // Confirm new bundle exists in Firestore
    const bundle = await this.bundleRepo.getById(input.bundleId);
    if (!bundle) {
      throw ApiError.badRequest("Invalid bundle");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // If already on this bundle → return early
    if (company.subscriptionPlan === input.bundleId) {
      return { bundleId: input.bundleId, status: 'already_active' };
    }

    // Update
    await this.companyRepository.update(input.companyId, {
      subscriptionPlan: input.bundleId,
      modules: bundle.modulesIncluded
    });

    // Return success DTO
    return { bundleId: input.bundleId, status: 'upgraded' };
  }
}
