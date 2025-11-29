
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

    // 1. Check if Super Admin
    const user = await this.userRepo.getUserById(userId);
    if (user && user.isAdmin()) {
      return ['*'];
    }

    // 2. Get Company User
    const companyUser = await this.companyUserRepo.getByUserAndCompany(userId, companyId);
    if (!companyUser) {
      return [];
    }

    // 3. Check if Owner
    if (companyUser.isOwner) {
      return ['*'];
    }

    // 4. Get Role Permissions
    const role = await this.companyRoleRepo.getById(companyId, companyUser.roleId);
    if (!role) {
      return [];
    }

    return role.permissions;
  }
}
