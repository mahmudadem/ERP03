
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { PermissionChecker } from '../PermissionChecker';

export class AssignRoleToCompanyUserUseCase {
  constructor(
    private companyUserRepo: ICompanyUserRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { companyId: string; targetUserId: string; roleId: string; actorId: string }): Promise<void> {
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');

    const companyUser = await this.companyUserRepo.getByUserAndCompany(request.targetUserId, request.companyId);
    if (!companyUser) throw new Error('User is not a member of this company');

    companyUser.roleId = request.roleId;
    await this.companyUserRepo.assignRole(companyUser);
  }
}
