export class ListAvailableBundlesUseCase {
    async execute(): Promise<any[]> {
        // In a real system, this would fetch from a BundleRepository
        // For MVP, we can return hardcoded bundles or fetch from a config
        return [
            { id: 'free', name: 'Free Tier', price: 0, features: ['basic_accounting'] },
            { id: 'pro', name: 'Professional', price: 29, features: ['basic_accounting', 'inventory', 'hr'] },
            { id: 'enterprise', name: 'Enterprise', price: 99, features: ['all'] }
        ];
    }
}
