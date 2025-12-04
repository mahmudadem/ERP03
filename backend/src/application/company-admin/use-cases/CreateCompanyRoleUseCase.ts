import { ICompanyRoleRepository } from '../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../domain/rbac/CompanyRole';
import { randomUUID } from 'crypto';

export interface CreateRoleInput {
  companyId: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
}

export class CreateCompanyRoleUseCase {
  constructor(
    private companyRoleRepository: ICompanyRoleRepository
  ) { }

  async execute(input: CreateRoleInput): Promise<CompanyRole> {
    // 1. Validate role name is unique (optional, but good practice)
    // For now, we'll assume the repository or database constraints handle this or we allow duplicates with different IDs.

    // 2. Create CompanyRole entity
    const newRole: CompanyRole = {
      id: randomUUID(),
      companyId: input.companyId,
      name: input.name,
      description: input.description || '',
      permissions: input.permissions,
      isSystem: input.isSystem || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 3. Save via companyRoleRepository.create()
    await this.companyRoleRepository.create(newRole);

    // 4. Return created role
    return newRole;
  }
}
