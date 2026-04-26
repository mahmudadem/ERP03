/**
 * BundleDefinition.ts
 * 
 * Dynamic bundle definition managed by Super Admin.
 * Bundles appear during company creation (not user signup).
 */

export type BundleLifecycleStatus = 'draft' | 'ready' | 'deprecated' | 'inactive';

export interface BundleDefinition {
  id: string;
  code?: string;
  name: string;
  description: string;
  businessDomains: string[];
  modulesIncluded: string[];
  capabilities?: string[];
  lifecycleStatus: BundleLifecycleStatus;
  createdAt: Date;
  updatedAt: Date;
}
