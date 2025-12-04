import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ApiError } from '../../../api/errors/ApiError';

export class GetCompanyRoleUseCase {
    constructor(private companyRoleRepository: ICompanyRoleRepository) { }

    async execute(companyId: string, roleId: string): Promise<any> {
        // Validate roleId + companyId
        if (!companyId || !roleId) {
            throw ApiError.badRequest("Missing required fields");
        }

        // Load role
        const role = await this.companyRoleRepository.getById(companyId, roleId);
        if (!role) {
            throw ApiError.notFound("Role not found");
        }

        // Return role details DTO
        return {
            roleId: role.id,
            name: role.name,
            description: role.description || '',
            isSystem: !!role.isSystem,
            permissions: role.permissions || [],
            createdAt: role.createdAt,
            updatedAt: role.updatedAt
        };
    }
}
