
import { ModuleDefinition } from '../../../domain/super-admin/ModuleDefinition';

/**
 * Repository interface for Module Registry management.
 */
export interface IModuleRegistryRepository {
  getAll(): Promise<ModuleDefinition[]>;
  getById(id: string): Promise<ModuleDefinition | null>;
  create(module: ModuleDefinition): Promise<void>;
  update(id: string, module: Partial<ModuleDefinition>): Promise<void>;
  delete(id: string): Promise<void>;
}
