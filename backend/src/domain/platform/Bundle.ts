/**
 * Bundle.ts
 * 
 * Defines the Bundle types that control which modules and features
 * are available to a company based on their subscription tier.
 */

export interface Bundle {
    id: string;
    name: string;
    description: string;
    modules: string[];
    features: string[];
}

export const BUNDLES: Bundle[] = [
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

export const getBundleById = (bundleId: string): Bundle | undefined => {
    return BUNDLES.find(b => b.id === bundleId);
};
