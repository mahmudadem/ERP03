import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { Feature } from './ListCompanyFeaturesUseCase';

export class ListActiveCompanyFeaturesUseCase {
    constructor(private companyRepository: ICompanyRepository) { }

    async execute(companyId: string): Promise<Feature[]> {
        const company = await this.companyRepository.findById(companyId);
        if (!company) {
            throw new Error('Company not found');
        }

        // In a real system, we would check company.features or subscription plan capabilities
        // For MVP, we'll assume all features are enabled for now or check a mock list
        // Let's assume we filter the full list based on some logic

        const allFeatures: Feature[] = [
            { id: 'advanced_reporting', name: 'Advanced Reporting', description: 'Access to advanced reports', category: 'reporting' },
            { id: 'api_access', name: 'API Access', description: 'Access to public API', category: 'integration' },
            { id: 'audit_logs', name: 'Audit Logs', description: 'View system audit logs', category: 'security' },
            { id: 'custom_roles', name: 'Custom Roles', description: 'Create custom roles', category: 'security' }
        ];

        // Simple logic: if pro/enterprise, enable all. If free, enable basic.
        if (company.subscriptionPlan === 'free') {
            return [];
        }

        return allFeatures;
    }
}
