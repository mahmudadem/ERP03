
import { Permission } from '../../../domain/rbac/Permission';

export interface IPermissionRepository {
  getAll(): Promise<Permission[]>;
  getById(id: string): Promise<Permission | null>;
  create(permission: Permission): Promise<void>;
  update(id: string, permission: Partial<Permission>): Promise<void>;
  delete(id: string): Promise<void>;
}
