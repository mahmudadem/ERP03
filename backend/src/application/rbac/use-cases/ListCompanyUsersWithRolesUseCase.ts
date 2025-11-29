
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { CompanyUser } from '../../../domain/rbac/CompanyUser';
import { PermissionChecker } from '../PermissionChecker';

export class ListCompanyUsersWithRolesUseCase {
  constructor(
    private companyUserRepo: ICompanyUserRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { companyId: string; actorId: string }): Promise<CompanyUser[]> {
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
    return this.companyUserRepo.getByCompany(request.companyId);
  }
}
