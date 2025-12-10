
import { PermissionDefinition } from '../../../domain/super-admin/PermissionDefinition';

/**
 * Repository interface for Permission Registry management.
 */
export interface IPermissionRegistryRepository {
  getAll(): Promise<PermissionDefinition[]>;
  getById(id: string): Promise<PermissionDefinition | null>;
  create(permission: PermissionDefinition): Promise<void>;
  update(id: string, permission: Partial<PermissionDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
