/**
 * FeatureFlagService.ts
 * 
 * Checks whether a feature is enabled at the Platform level (global)
 * or at the Company level (tenant-specific).
 */

import { ICompanyModuleSettingsRepository } from '../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { getBundleById } from '../../domain/platform/Bundle';

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
        private companyModuleSettingsRepo: ICompanyModuleSettingsRepository
    ) { }

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

        // For now, we'll use a simplified approach
        // In a full implementation, bundle info would come from Company entity
        // For MVP, we'll default to 'starter' bundle
        // TODO: Get bundle from Company entity
        const bundleId = 'starter';
        const bundle = getBundleById(bundleId);

        if (bundle && bundle.features.includes(featureId)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a module is enabled for a company
     */
    async isModuleEnabledForCompany(companyId: string, moduleId: string): Promise<boolean> {
        // For now, use simplified approach
        // TODO: Get bundle from Company entity
        const bundleId = 'starter';
        const bundle = getBundleById(bundleId);

        return bundle ? bundle.modules.includes(moduleId) : false;
    }
}
