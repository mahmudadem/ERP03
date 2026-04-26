/**
 * EntitlementService Interface
 *
 * Defines the boundary for checking company entitlements.
 * Phase 2: Real implementation using CompanyEntitlement tables.
 */
export interface IEntitlementService {
  companyHasModule(companyId: string, moduleId: string): Promise<boolean>;
  companyHasCapability(companyId: string, capabilityId: string): Promise<boolean>;
  getEntitledModules(companyId: string): Promise<string[]>;
  getEntitledCapabilities(companyId: string): Promise<string[]>;
  grantModule(companyId: string, moduleId: string, sourceType: string, sourceId: string): Promise<void>;
  revokeModule(companyId: string, moduleId: string): Promise<void>;
}