/**
 * DisableCapabilityForCompanyUseCase
 *
 * Disables a capability for a company.
 * Only changes the enabled state, preserves entitlements.
 */
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ICapabilityRegistryRepository } from '../../../repository/interfaces/company/ICapabilityRegistryRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class DisableCapabilityForCompanyUseCase {
  constructor(
    private companyRepository: ICompanyRepository,
    private capabilityRepository: ICapabilityRegistryRepository
  ) {}

  async execute(input: { companyId: string; capabilityCode: string }): Promise<any> {
    const capabilityCode = String(input.capabilityCode || '').trim().toLowerCase();

    if (!input.companyId || !capabilityCode) {
      throw ApiError.badRequest('Missing required fields');
    }

    const company = await this.companyRepository.findById(input.companyId);
    if (!company) {
      throw ApiError.notFound('Company not found');
    }

    const capabilityState = await this.capabilityRepository.getByCompanyAndCapability(input.companyId, capabilityCode);
    
    if (!capabilityState || !capabilityState.isEnabled) {
      throw ApiError.badRequest('Capability is not enabled for this company');
    }

    await this.capabilityRepository.setEnabled(input.companyId, capabilityCode, false);

    return { capabilityCode, status: 'disabled' };
  }
}