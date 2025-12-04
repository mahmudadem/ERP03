"use strict";
/**
 * Bundle.ts
 *
 * Defines the Bundle types that control which modules and features
 * are available to a company based on their subscription tier.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBundleById = exports.BUNDLES = void 0;
exports.BUNDLES = [
    {
        id: 'starter',
        name: 'Starter',
        description: 'Basic features for small businesses',
        modules: ['accounting'],
        features: ['accounting.basic', 'reports.basic']
    },
    {
        id: 'professional',
        name: 'Professional',
        description: 'Advanced features for growing businesses',
        modules: ['accounting', 'inventory'],
        features: ['accounting.advanced', 'inventory.basic', 'reports.advanced']
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Full suite for large organizations',
        modules: ['accounting', 'inventory', 'hr', 'pos'],
        features: ['accounting.advanced', 'inventory.advanced', 'hr.full', 'pos.full', 'reports.full', 'api.access']
    }
];
const getBundleById = (bundleId) => {
    return exports.BUNDLES.find(b => b.id === bundleId);
};
exports.getBundleById = getBundleById;
//# sourceMappingURL=Bundle.js.map