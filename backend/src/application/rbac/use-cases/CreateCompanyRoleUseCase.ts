
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { PermissionChecker } from '../PermissionChecker';

export class CreateCompanyRoleUseCase {
  constructor(
    private companyRoleRepo: ICompanyRoleRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { 
    companyId: string; 
    name: string; 
    permissions: string[]; 
    description?: string; 
    sourceTemplateId?: string;
    actorId: string;
  }): Promise<CompanyRole> {
    
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');

    const newRole: CompanyRole = {
      id: `role_${Date.now()}`,
      companyId: request.companyId,
      name: request.name,
      description: request.description,
      permissions: request.permissions,
      sourceTemplateId: request.sourceTemplateId,
      isDefaultForNewUsers: false
    };

    await this.companyRoleRepo.create(newRole);
    return newRole;
  }
}
