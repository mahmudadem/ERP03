"use strict";
/**
 * FeatureFlagService.ts
 *
 * Checks whether a feature is enabled at the Platform level (global)
 * or at the Company level (tenant-specific).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
class FeatureFlagService {
    constructor(bundleRepo, companyRepo) {
        this.bundleRepo = bundleRepo;
        this.companyRepo = companyRepo;
        this.globalFlags = {
            // Platform-level feature flags
            'beta.newUI': false,
            'experimental.sqlBackend': false,
        };
    }
    /**
     * Check if a feature is enabled globally (platform-wide)
     */
    isGlobalFeatureEnabled(featureId) {
        var _a;
        return (_a = this.globalFlags[featureId]) !== null && _a !== void 0 ? _a : false;
    }
    /**
     * Check if a feature is enabled for a specific company
     * based on their bundle and custom settings
     */
    async isFeatureEnabledForCompany(companyId, featureId) {
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
    async isModuleEnabledForCompany(companyId, moduleId) {
        // Get company to find its bundle
        const company = await this.companyRepo.findById(companyId);
        if (!company || !company.subscriptionPlan) {
            return false;
        }
        const bundle = await this.bundleRepo.getById(company.subscriptionPlan);
        return bundle ? bundle.modulesIncluded.includes(moduleId) : false;
    }
}
exports.FeatureFlagService = FeatureFlagService;
//# sourceMappingURL=FeatureFlagService.js.map