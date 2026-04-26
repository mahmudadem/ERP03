"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModuleActivationService = void 0;
/**
 * ModuleActivationService
 *
 * Handles the activation of modules and their dependencies.
 * Implements the "Implicit Activation" pattern where activating a module
 * automatically ensures its foundational dependencies are initialized.
 */
class ModuleActivationService {
    constructor(companyModuleRepo) {
        this.companyModuleRepo = companyModuleRepo;
    }
    /**
     * Activates a module for a company.
     * If the module has dependencies, they are activated in "Implicit" mode.
     */
    async activateModule(companyId, moduleCode, userId) {
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
    async ensureInitialized(companyId, moduleCode, isImplicit) {
        var _a;
        const existing = await this.companyModuleRepo.get(companyId, moduleCode);
        if (existing) {
            if (!isImplicit && ((_a = existing.config) === null || _a === void 0 ? void 0 : _a.isImplicit)) {
                await this.companyModuleRepo.update(companyId, moduleCode, {
                    config: Object.assign(Object.assign({}, existing.config), { isImplicit: false }),
                    updatedAt: new Date()
                });
            }
            return;
        }
        const newModule = {
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
    async getActiveModules(companyId, includeImplicit = false) {
        const modules = await this.companyModuleRepo.listByCompany(companyId);
        return modules
            .filter(m => { var _a; return includeImplicit || !((_a = m.config) === null || _a === void 0 ? void 0 : _a.isImplicit); })
            .map(m => m.moduleCode);
    }
}
exports.ModuleActivationService = ModuleActivationService;
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
ModuleActivationService.DEPENDENCIES = {
    'hr': ['accounting'],
    'procurement': ['inventory'],
};
//# sourceMappingURL=ModuleActivationService.js.map