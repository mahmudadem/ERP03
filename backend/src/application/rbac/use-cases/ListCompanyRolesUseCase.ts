
import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { PermissionChecker } from '../PermissionChecker';

export class ListCompanyRolesUseCase {
  constructor(
    private companyRoleRepo: ICompanyRoleRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(request: { companyId: string; actorId: string }): Promise<CompanyRole[]> {
    // View permissions usually required, or maybe just being a member?
    // Assuming 'system.roles.manage' or basic access. 
    // Let's assume anyone in the company can see roles for now, or enforce 'system.roles.manage' if it's for management.
    // The prompt says "Validate user has system.roles.manage OR isOwner to manage roles."
    // Listing might be needed for assigning too. Let's enforce manage for now as per "manage roles".
    await this.permissionChecker.assertOrThrow(request.actorId, request.companyId, 'system.roles.manage');
    
    return this.companyRoleRepo.getAll(request.companyId);
  }
}
