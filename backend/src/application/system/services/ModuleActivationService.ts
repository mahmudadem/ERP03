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
   *
   * NOTE: Accounting is intentionally NOT listed as a dependency of operational
   * modules (inventory, sales, purchase). Operational modules gracefully degrade
   * when Accounting is disabled — the createAccountingEffect flag causes posting
   * use cases to skip GL operations. Users opt into Accounting separately when
   * they want financial integration.
   */
  private static readonly DEPENDENCIES: Record<string, string[]> = {
    'hr': ['accounting'],
    'procurement': ['inventory'],
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
   * Ensures a module is installed for a company.
   * @param isImplicit If true, the module is activated for "foundational" purposes 
   *                   and might not show up in the main sidebar immediately.
   */
  private async ensureInitialized(companyId: string, moduleCode: string, isImplicit: boolean): Promise<void> {
    const existing = await this.companyModuleRepo.get(companyId, moduleCode);

    if (existing) {
      if (!isImplicit && existing.config?.isImplicit) {
        await this.companyModuleRepo.update(companyId, moduleCode, {
          config: { ...existing.config, isImplicit: false },
          updatedAt: new Date()
        });
      }
      return;
    }

    const newModule: CompanyModule = {
      companyId,
      moduleCode,
      installedAt: new Date(),
      initialized: false,
      initializationStatus: 'pending',
      config: {
        isImplicit,
        activatedAt: new Date().toISOString()
      },
      updatedAt: new Date()
    };

    await this.companyModuleRepo.create(newModule);
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
