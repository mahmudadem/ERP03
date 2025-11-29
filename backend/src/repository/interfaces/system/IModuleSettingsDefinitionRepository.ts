import { ModuleSettingsDefinition } from '../../../domain/system/ModuleSettingsDefinition';

export interface IModuleSettingsDefinitionRepository {
  listDefinitions(): Promise<ModuleSettingsDefinition[]>;
  getDefinition(moduleId: string): Promise<ModuleSettingsDefinition | null>;
  createDefinition(def: ModuleSettingsDefinition): Promise<void>;
  updateDefinition(moduleId: string, def: Partial<ModuleSettingsDefinition>): Promise<void>;
  deleteDefinition(moduleId: string): Promise<void>;
}
