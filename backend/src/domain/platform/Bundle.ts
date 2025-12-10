/**
 * Bundle.ts
 * 
 * Bundle interface for dynamic bundle definitions.
 * All bundles are now managed by Super Admin and stored in system_metadata/bundles.
 * 
 * IMPORTANT: No hardcoded bundles exist here anymore.
 */

export interface Bundle {
    id: string;
    name: string;
    description: string;
    businessDomains: string[];      // Array of business domain IDs
    modulesIncluded: string[];      // Array of module IDs
    createdAt: Date;
    updatedAt: Date;
}
