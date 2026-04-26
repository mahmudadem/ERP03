/**
 * Repository interface for Capability Registry operations
 */
import { CapabilityRegistry, CompanyCapability } from '../../../domain/company/entities/CompanyCapability';

export interface ICapabilityRegistryRepository {
  // Module Capability Registry
  getAll(): Promise<CapabilityRegistry[]>;
  getById(id: string): Promise<CapabilityRegistry | null>;
  getByCode(code: string): Promise<CapabilityRegistry | null>;
  getByModuleId(moduleId: string): Promise<CapabilityRegistry[]>;
  getReady(moduleId?: string): Promise<CapabilityRegistry[]>;
  create(capability: CapabilityRegistry): Promise<void>;
  update(id: string, updates: Partial<CapabilityRegistry>): Promise<void>;
  delete(id: string): Promise<void>;

  // Company Capability
  getByCompanyId(companyId: string): Promise<CompanyCapability[]>;
  getByCompanyAndCapability(companyId: string, capabilityId: string): Promise<CompanyCapability | null>;
  setEnabled(companyId: string, capabilityId: string, isEnabled: boolean): Promise<void>;
  setConfig(companyId: string, capabilityId: string, config: Record<string, any>): Promise<void>;
}