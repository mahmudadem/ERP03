
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';

export class GetCurrentUserPermissionsForCompanyUseCase {
  constructor(
    private userRepo: IUserRepository,
    private companyUserRepo: ICompanyUserRepository,
    private companyRoleRepo: ICompanyRoleRepository
  ) {}

  async execute(request: { userId: string; companyId: string }): Promise<string[]> {
    const { userId, companyId } = request;

    const user = await this.userRepo.getUserById(userId);
    if (user && user.isAdmin()) {
      return ['*'];
    }

    const companyUser = await this.companyUserRepo.getByUserAndCompany(userId, companyId);
    if (!companyUser) {
      return [];
    }

    if (companyUser.isOwner) {
      return ['*'];
    }

    const role = await this.companyRoleRepo.getById(companyId, companyUser.roleId);
    if (!role) {
      return [];
    }

    return role.resolvedPermissions || role.permissions || [];
  }
}
