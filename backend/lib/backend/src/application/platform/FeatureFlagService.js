"use strict";
/**
 * FeatureFlagService.ts
 *
 * Checks whether a feature is enabled at the Platform level (global)
 * or at the Company level (tenant-specific).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureFlagService = void 0;
const Bundle_1 = require("../../domain/platform/Bundle");
class FeatureFlagService {
    constructor() {
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
        // For now, we'll use a simplified approach
        // In a full implementation, bundle info would come from Company entity
        // For MVP, we'll default to 'starter' bundle
        // TODO: Get bundle from Company entity
        const bundleId = 'starter';
        const bundle = (0, Bundle_1.getBundleById)(bundleId);
        if (bundle && bundle.features.includes(featureId)) {
            return true;
        }
        return false;
    }
    /**
     * Check if a module is enabled for a company
     */
    async isModuleEnabledForCompany(companyId, moduleId) {
        // For now, use simplified approach
        // TODO: Get bundle from Company entity
        const bundleId = 'starter';
        const bundle = (0, Bundle_1.getBundleById)(bundleId);
        return bundle ? bundle.modules.includes(moduleId) : false;
    }
}
exports.FeatureFlagService = FeatureFlagService;
//# sourceMappingURL=FeatureFlagService.js.map