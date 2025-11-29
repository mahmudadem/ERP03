import { ModulePermissionsDefinition } from '../../../domain/system/ModulePermissionsDefinition';

export interface IModulePermissionsDefinitionRepository {
  list(): Promise<ModulePermissionsDefinition[]>;
  getByModuleId(moduleId: string): Promise<ModulePermissionsDefinition | null>;
  create(def: ModulePermissionsDefinition): Promise<void>;
  update(moduleId: string, partial: Partial<ModulePermissionsDefinition>): Promise<void>;
  delete(moduleId: string): Promise<void>;
}
