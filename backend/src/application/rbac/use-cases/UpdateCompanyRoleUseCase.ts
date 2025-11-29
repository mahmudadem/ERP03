
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { PermissionChecker } from '../PermissionChecker';

export class UpdateCompanyRoleUseCase {
  constructor(
    private companyRoleRepo: ICompanyRoleRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { 
    companyId: string; 
    roleId: string; 
    updates: { name?: string; description?: string; permissions?: string[] };
    actorId: string;
  }): Promise<void> {
    
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');

    const role = await this.companyRoleRepo.getById(request.companyId, request.roleId);
    if (!role) throw new Error('Role not found');

    await this.companyRoleRepo.update(request.companyId, request.roleId, request.updates);
  }
}
