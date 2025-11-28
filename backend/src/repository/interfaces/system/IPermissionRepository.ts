
import { Permission } from '../../../domain/system/entities/Permission';

/**
 * Interface for Permission management access.
 */
export interface IPermissionRepository {
  getPermissionsByRole(roleId: string): Promise<Permission[]>;
  assignPermissions(roleId: string, permissions: string[]): Promise<void>;
}
