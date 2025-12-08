import { ModuleRegistry } from '../../platform/ModuleRegistry';
import { ApiError } from '../../../api/errors/ApiError';

export class ListCompanyModulesUseCase {
    async execute(input: { companyId: string }): Promise<any[]> {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError.badRequest("Missing companyId");
        }

        // Load all modules from ModuleRegistry
        const modules = ModuleRegistry.getInstance().getAllModules();

        // Return
        return modules.map(m => ({
            id: m.metadata.id,
            name: m.metadata.name,
            description: m.metadata.description || '',
            permissions: m.permissions || []
        }));
    }
}
