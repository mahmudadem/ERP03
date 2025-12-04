import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';

export interface UpdateRoleInput {
  companyId: string;
  roleId: string;
  name?: string;
  description?: string;
  permissions?: string[];
  isDefaultForNewUsers?: boolean;
}

export class UpdateCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository
  ) { }

  async execute(input: UpdateRoleInput): Promise<void> {
    // 1. Load role via companyRoleRepository.getById()
    const role = await this.companyRoleRepository.getById(input.companyId, input.roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    // 2. Verify role is not "Owner" or System role if we want to protect them
    // (Assuming "Owner" role might be protected, or isSystem flag)
    if (role.isSystem) {
      // We might allow updating description but not permissions for system roles?
      // For now, let's allow updates but maybe warn or restrict name changes if critical.
      // Let's assume full update is allowed for now unless it's a critical system role.
    }

    // 3. Prepare updates
    const updates: Partial<CompanyRole> = {
      updatedAt: new Date()
    };

    if (input.name) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.permissions) updates.permissions = input.permissions;
    if (input.isDefaultForNewUsers !== undefined) updates.isDefaultForNewUsers = input.isDefaultForNewUsers;

    // 4. Save via companyRoleRepository.update()
    await this.companyRoleRepository.update(input.companyId, input.roleId, updates);
  }
}
