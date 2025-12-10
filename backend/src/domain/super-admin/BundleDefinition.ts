/**
 * BundleDefinition.ts
 * 
 * Dynamic bundle definition managed by Super Admin.
 * Bundles appear during company creation (not user signup).
 */

export interface BundleDefinition {
  id: string;
  name: string;
  description: string;
  businessDomains: string[];      // Array of business domain IDs
  modulesIncluded: string[];      // Array of module IDs
  createdAt: Date;
  updatedAt: Date;
}
