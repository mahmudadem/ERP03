import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';

export class ListCompanyRolesUseCase {
    constructor(private companyRoleRepository: ICompanyRoleRepository) { }

    async execute(companyId: string): Promise<CompanyRole[]> {
        return this.companyRoleRepository.getAll(companyId);
    }
}
