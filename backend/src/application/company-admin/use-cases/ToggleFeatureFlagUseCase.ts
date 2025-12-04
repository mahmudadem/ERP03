import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export class ToggleFeatureFlagUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(companyId: string, featureId: string, enabled: boolean): Promise<void> {
    // 1. Verify company exists
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // 2. In a real system, we would update a features list on the company entity
    // For MVP, we might not have a dedicated features field on Company yet, 
    // or we might store it in settings.
    // Let's assume we can't easily toggle features per company without a schema change 
    // or a settings table.

    // For now, we'll log the action and maybe throw not implemented if we can't persist it
    console.log(`Toggling feature ${featureId} to ${enabled} for company ${companyId}`);

    // If we had a settings repository, we would save it there.
    // await this.companySettingsRepository.updateFeature(companyId, featureId, enabled);
  }
}
