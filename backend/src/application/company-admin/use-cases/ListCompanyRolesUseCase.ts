import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class ListCompanyRolesUseCase {
    constructor(private companyRoleRepository: ICompanyRoleRepository) { }

    async execute(input: { companyId: string }): Promise<any[]> {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError.badRequest("Missing companyId");
        }

        // Load roles
        const roles = await this.companyRoleRepository.getAll(input.companyId);

        // Sort system roles first
        roles.sort((a, b) => Number(b.isSystem) - Number(a.isSystem));

        // Return DTO
        return roles.map(r => ({
            roleId: r.id,
            name: r.name,
            description: r.description || '',
            isSystem: !!r.isSystem,
            permissions: r.permissions || []
        }));
    }
}
