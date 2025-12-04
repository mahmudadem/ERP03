import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';

export class GetCompanyRoleUseCase {
    constructor(private companyRoleRepository: ICompanyRoleRepository) { }

    async execute(companyId: string, roleId: string): Promise<CompanyRole | null> {
        return this.companyRoleRepository.getById(companyId, roleId);
    }
}
