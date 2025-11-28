
import { Role } from '../../../domain/system/entities/Role';

/**
 * Interface for Role management access.
 */
export interface IRoleRepository {
  createRole(companyId: string, role: Role): Promise<void>;
  updateRole(roleId: string, data: Partial<Role>): Promise<void>;
  getRole(roleId: string): Promise<Role | null>;
  getCompanyRoles(companyId: string): Promise<Role[]>;
}
