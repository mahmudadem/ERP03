import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

export class UpgradeCompanyBundleUseCase {
  constructor(
    private companyRepository: ICompanyRepository
  ) { }

  async execute(companyId: string, newBundleId: string): Promise<void> {
    // 1. Verify company exists
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // 2. In a real system, we would:
    //    - Verify the bundle exists
    //    - Handle payment processing
    //    - Update subscription status

    // For MVP, we just update the subscriptionPlan field
    await this.companyRepository.update(companyId, {
      subscriptionPlan: newBundleId,
      updatedAt: new Date()
    });
  }
}
