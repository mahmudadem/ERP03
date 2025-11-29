
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { ICompanyUserRepository } from '../../../repository/interfaces/rbac/ICompanyUserRepository';
import { PermissionChecker } from '../PermissionChecker';

export class DeleteCompanyRoleUseCase {
  constructor(
    private companyRoleRepo: ICompanyRoleRepository,
    private companyUserRepo: ICompanyUserRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { companyId: string; roleId: string; actorId: string }): Promise<void> {
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');

    const role = await this.companyRoleRepo.getById(request.companyId, request.roleId);
    if (!role) throw new Error('Role not found');

    // Check if in use
    const users = await this.companyUserRepo.getByCompany(request.companyId);
    const inUse = users.some(u => u.roleId === request.roleId);
    if (inUse) {
      throw new Error('Cannot delete role because it is assigned to one or more users.');
    }

    await this.companyRoleRepo.delete(request.companyId, request.roleId);
  }
}
