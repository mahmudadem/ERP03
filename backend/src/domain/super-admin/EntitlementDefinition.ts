/**
 * CompanyEntitlement Domain Models
 */

export type EntitlementSourceType = 'bundle' | 'superadmin_override' | 'trial' | 'promotion';
export type EntitlementItemType = 'module' | 'capability';

export interface CompanyEntitlement {
  id: string;
  companyId: string;
  sourceType: EntitlementSourceType;
  sourceId: string;
  validFrom: Date;
  validUntil?: Date;
  isActive: boolean;
  items: CompanyEntitlementItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyEntitlementItem {
  id: string;
  entitlementId: string;
  itemType: EntitlementItemType;
  itemKey: string;
  createdAt: Date;
}

export interface BundleItem {
  id: string;
  bundleId: string;
  itemType: EntitlementItemType;
  itemKey: string;
  createdAt: Date;
}

export interface BundleDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  lifecycleStatus: 'draft' | 'ready' | 'deprecated' | 'inactive';
  items: BundleItem[];
  createdAt: Date;
  updatedAt: Date;
}