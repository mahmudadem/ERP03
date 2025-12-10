/**
 * FeatureFlagService.ts
 * 
 * Checks whether a feature is enabled at the Platform level (global)
 * or at the Company level (tenant-specific).
 */

import { IBundleRegistryRepository } from '../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { ICompanyRepository } from '../../repository/interfaces/core/ICompanyRepository';

export interface FeatureFlagConfig {
    globalFlags: Record<string, boolean>;
}

export class FeatureFlagService {
    private globalFlags: Record<string, boolean> = {
        // Platform-level feature flags
        'beta.newUI': false,
        'experimental.sqlBackend': false,
    };

    constructor(
        private bundleRepo: IBundleRegistryRepository,
        private companyRepo: ICompanyRepository
    ) {}

    /**
     * Check if a feature is enabled globally (platform-wide)
     */
    isGlobalFeatureEnabled(featureId: string): boolean {
        return this.globalFlags[featureId] ?? false;
    }

    /**
     * Check if a feature is enabled for a specific company
     * based on their bundle and custom settings
     */
    async isFeatureEnabledForCompany(companyId: string, featureId: string): Promise<boolean> {
        // First check global flags
        if (this.isGlobalFeatureEnabled(featureId)) {
            return true;
        }

        // Get company to find its bundle
        const company = await this.companyRepo.findById(companyId);
        if (!company || !company.subscriptionPlan) {
            return false;
        }

        // Note: features were removed from Bundle structure
        // This method needs to be redesigned for new bundle architecture
        return false;
    }

    /**
     * Check if a module is enabled for a company
     */
    async isModuleEnabledForCompany(companyId: string, moduleId: string): Promise<boolean> {
        // Get company to find its bundle
        const company = await this.companyRepo.findById(companyId);
        if (!company || !company.subscriptionPlan) {
            return false;
        }

        const bundle = await this.bundleRepo.getById(company.subscriptionPlan);

        return bundle ? bundle.modulesIncluded.includes(moduleId) : false;
    }
}
