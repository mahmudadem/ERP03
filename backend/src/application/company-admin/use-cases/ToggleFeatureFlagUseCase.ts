import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Features } from '../../../domain/platform/FeatureRegistry';
import { ApiError } from '../../../api/errors/ApiError';

export class ToggleFeatureFlagUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(input: { companyId: string; featureName: string; enabled: boolean }): Promise<any> {
    // Validate featureName exists in registry
    const feature = Features[input.featureName];
    if (!feature) {
      throw ApiError.badRequest("Invalid feature");
    }

    // Load company
    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound("Company not found");
    }

    // Ensure company.features exists
    const features = ((company as any).features ?? []) as string[];

    // Toggle logic
    if (input.enabled) {
      if (!features.includes(input.featureName)) {
        features.push(input.featureName);
      }
    } else {
      const idx = features.indexOf(input.featureName);
      if (idx !== -1) {
        features.splice(idx, 1);
      }
    }

    // Save
    await this.companyRepository.update(input.companyId, { features } as any);

    // Return
    return {
      companyId: input.companyId,
      featureName: input.featureName,
      enabled: input.enabled,
      activeFeatures: features
    };
  }
}
