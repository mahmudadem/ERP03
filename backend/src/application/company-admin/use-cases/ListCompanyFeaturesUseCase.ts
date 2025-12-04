// For now, we don't have a FeatureRepository, so we'll mock the features list or fetch from a config
// In a real system, this would come from a database or configuration service

export interface Feature {
    id: string;
    name: string;
    description: string;
    category: string;
}

export class ListCompanyFeaturesUseCase {
    async execute(companyId: string): Promise<Feature[]> {
        // Return hardcoded list of features for MVP
        return [
            { id: 'advanced_reporting', name: 'Advanced Reporting', description: 'Access to advanced reports', category: 'reporting' },
            { id: 'api_access', name: 'API Access', description: 'Access to public API', category: 'integration' },
            { id: 'audit_logs', name: 'Audit Logs', description: 'View system audit logs', category: 'security' },
            { id: 'custom_roles', name: 'Custom Roles', description: 'Create custom roles', category: 'security' }
        ];
    }
}
