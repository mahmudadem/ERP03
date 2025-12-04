
import { Module } from '../../../domain/system/entities/Module';

/**
 * Interface for Module configuration access.
 */
export interface IModuleRepository {
  findAll(): Promise<Module[]>;
  getEnabledModules(companyId: string): Promise<Module[]>;
  enableModule(companyId: string, moduleName: string): Promise<void>;
  disableModule(companyId: string, moduleName: string): Promise<void>;
}
