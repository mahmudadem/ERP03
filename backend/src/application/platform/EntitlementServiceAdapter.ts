/**
 * EntitlementServiceAdapter
 *
 * Phase 1 stub implementation that reads entitlements from existing company.modules array.
 * This adapter provides compatibility with the legacy data model.
 *
 * Phase 2: Replace internals with normalized CompanyEntitlement tables.
 */
import { IEntitlementService } from './IEntitlementService';
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';

export class EntitlementServiceAdapter implements IEntitlementService {
  constructor(private companyRepository: ICompanyRepository) {}

  async companyHasModule(companyId: string, moduleId: string): Promise<boolean> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) return false;

    const modules = Array.isArray((company as any).modules) ? (company as any).modules : [];
    return modules
      .map((m: string) => String(m || '').trim().toLowerCase())
      .filter(Boolean)
      .includes(moduleId.toLowerCase());
  }

  async companyHasCapability(companyId: string, capabilityId: string): Promise<boolean> {
    const moduleId = capabilityId.split('.')[0];
    return this.companyHasModule(companyId, moduleId);
  }

  async getEntitledModules(companyId: string): Promise<string[]> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) return [];

    const modules = Array.isArray((company as any).modules) ? (company as any).modules : [];
    return modules
      .map((m: string) => String(m || '').trim().toLowerCase())
      .filter(Boolean);
  }

  async getEntitledCapabilities(companyId: string): Promise<string[]> {
    return [];
  }

  async grantModule(companyId: string, moduleId: string, sourceType: string, sourceId: string): Promise<void> {
    throw new Error('grantModule not supported in adapter mode');
  }

  async revokeModule(companyId: string, moduleId: string): Promise<void> {
    throw new Error('revokeModule not supported in adapter mode');
  }
}