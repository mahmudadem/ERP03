"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingBootstrapService = void 0;
const accountingDefinitions_1 = require("../../config/defaults/accountingDefinitions");
/**
 * Ensures accounting module settings and permissions definitions exist.
 * Can be invoked during startup or migration scripts.
 */
class AccountingBootstrapService {
    constructor(settingsDefRepo, permDefRepo) {
        this.settingsDefRepo = settingsDefRepo;
        this.permDefRepo = permDefRepo;
    }
    async ensureDefaults() {
        const settingsDef = await this.settingsDefRepo.getDefinition('accounting');
        if (!settingsDef) {
            await this.settingsDefRepo.createDefinition(accountingDefinitions_1.accountingModuleSettingsDefinition);
        }
        const permDef = await this.permDefRepo.getByModuleId('accounting');
        if (!permDef) {
            await this.permDefRepo.create(accountingDefinitions_1.accountingModulePermissionsDefinition);
        }
    }
}
exports.AccountingBootstrapService = AccountingBootstrapService;
//# sourceMappingURL=AccountingBootstrapService.js.map