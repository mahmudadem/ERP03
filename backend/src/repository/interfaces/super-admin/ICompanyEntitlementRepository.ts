/**
 * Repository interface for Company Entitlements
 */
import { CompanyEntitlement, CompanyEntitlementItem, BundleDefinition, BundleItem } from '../../../domain/super-admin/EntitlementDefinition';

export interface ICompanyEntitlementRepository {
  // Entitlement CRUD
  getByCompanyId(companyId: string): Promise<CompanyEntitlement[]>;
  getActiveByCompanyId(companyId: string): Promise<CompanyEntitlement[]>;
  getEntitlementById(id: string): Promise<CompanyEntitlement | null>;
  createEntitlement(entitlement: CompanyEntitlement): Promise<void>;
  updateEntitlement(id: string, updates: Partial<CompanyEntitlement>): Promise<void>;
  deactivateEntitlement(id: string): Promise<void>;

  // Entitlement Items
  addItem(entitlementId: string, item: CompanyEntitlementItem): Promise<void>;
  removeItem(entitlementId: string, itemKey: string): Promise<void>;
  getItemsByEntitlementId(entitlementId: string): Promise<CompanyEntitlementItem[]>;

  // Effective entitlements (derived)
  getEffectiveModules(companyId: string): Promise<string[]>;
  getEffectiveCapabilities(companyId: string): Promise<string[]>;
  hasModule(companyId: string, moduleId: string): Promise<boolean>;
  hasCapability(companyId: string, capabilityId: string): Promise<boolean>;
}

export interface IBundleItemRepository {
  getByBundleId(bundleId: string): Promise<BundleItem[]>;
  getModuleKeysByBundleId(bundleId: string): Promise<string[]>;
  getCapabilityKeysByBundleId(bundleId: string): Promise<string[]>;
  addItem(bundleId: string, item: Omit<BundleItem, 'id' | 'bundleId' | 'createdAt'>): Promise<void>;
  removeItem(bundleId: string, itemKey: string): Promise<void>;
  clearItems(bundleId: string): Promise<void>;
}

export interface IBundleRegistryRepository {
  getAll(): Promise<BundleDefinition[]>;
  getById(id: string): Promise<BundleDefinition | null>;
  getByCode(code: string): Promise<BundleDefinition | null>;
  create(bundle: BundleDefinition): Promise<void>;
  update(id: string, bundle: Partial<BundleDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
  getReady(): Promise<BundleDefinition[]>;
}