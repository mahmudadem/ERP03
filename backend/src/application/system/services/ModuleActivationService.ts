import { ICompanyModuleRepository } from '../../../repository/interfaces/company/ICompanyModuleRepository';
import { CompanyModule } from '../../../domain/company/entities/CompanyModule';

/**
 * ModuleActivationService
 * 
 * Handles the activation of modules and their dependencies.
 * Implements the "Implicit Activation" pattern where activating a module
 * automatically ensures its foundational dependencies are initialized.
 */
export class ModuleActivationService {
  /**
   * Static dependency map.
   * Key: Module that depends on others
   * Value: Array of dependent module codes
   */
  private static readonly DEPENDENCIES: Record<string, string[]> = {
    'hr': ['accounting'],
    'sales': ['accounting'],
    'inventory': ['accounting'],
    'procurement': ['accounting', 'inventory'],
  };

  constructor(
    private companyModuleRepo: ICompanyModuleRepository
  ) {}

  /**
   * Activates a module for a company.
   * If the module has dependencies, they are activated in "Implicit" mode.
   */
  async activateModule(companyId: string, moduleCode: string, userId: string): Promise<void> {
    const dependencies = ModuleActivationService.DEPENDENCIES[moduleCode] || [];
    
    // 1. Activate dependencies implicitly first
    for (const depCode of dependencies) {
      await this.ensureInitialized(companyId, depCode, true);
    }

    // 2. Activate the target module explicitly
    await this.ensureInitialized(companyId, moduleCode, false);
  }

  /**
   * Ensures a module is initialized for a company.
   * @param isImplicit If true, the module is activated for "foundational" purposes 
   *                   and might not show up in the main sidebar immediately.
   */
  private async ensureInitialized(companyId: string, moduleCode: string, isImplicit: boolean): Promise<void> {
    const existing = await this.companyModuleRepo.get(companyId, moduleCode);

    if (existing) {
      // If it exists but was implicit and we are now activating it explicitly, update it.
      if (!isImplicit && existing.config?.isImplicit) {
        await this.companyModuleRepo.update(companyId, moduleCode, {
          config: { ...existing.config, isImplicit: false },
          updatedAt: new Date()
        });
      }
      return;
    }

    // Create new module activation record
    const newModule: CompanyModule = {
      companyId,
      moduleCode,
      installedAt: new Date(),
      initialized: true,
      initializationStatus: 'complete',
      config: {
        isImplicit,
        activatedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    };

    await this.companyModuleRepo.create(newModule);
    
    // TODO: Trigger module-specific seeding/foundational setup here
    // e.g. If moduleCode === 'accounting', seed Fiscal Year / Tax Categories
  }

  /**
   * Gets all active modules, excluding implicit ones if requested.
   */
  async getActiveModules(companyId: string, includeImplicit: boolean = false): Promise<string[]> {
    const modules = await this.companyModuleRepo.listByCompany(companyId);
    return modules
      .filter(m => includeImplicit || !m.config?.isImplicit)
      .map(m => m.moduleCode);
  }
}
