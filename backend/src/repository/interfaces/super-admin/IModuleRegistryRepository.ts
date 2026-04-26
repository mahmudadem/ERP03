
import {
  ModuleDefinition,
  LifecycleStatus,
  RuntimeStatus,
  ImplementationStatus,
} from '../../../domain/super-admin/ModuleDefinition';

/**
 * Repository interface for Module Registry management.
 */
export interface IModuleRegistryRepository {
  getAll(): Promise<ModuleDefinition[]>;
  getById(id: string): Promise<ModuleDefinition | null>;
  getByCode(code: string): Promise<ModuleDefinition | null>;
  create(module: ModuleDefinition): Promise<void>;
  update(id: string, module: Partial<ModuleDefinition>): Promise<void>;
  updateImplementationCheck(
    id: string,
    status: ImplementationStatus,
    error: string | null,
    checkedAt: Date
  ): Promise<void>;
  updateLifecycleStatus(id: string, status: LifecycleStatus): Promise<void>;
  updateRuntimeStatus(id: string, status: RuntimeStatus): Promise<void>;
  delete(id: string): Promise<void>;
  getByLifecycleStatus(status: LifecycleStatus): Promise<ModuleDefinition[]>;
}
