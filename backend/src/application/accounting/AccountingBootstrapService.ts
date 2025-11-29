import { accountingModulePermissionsDefinition, accountingModuleSettingsDefinition } from '../../config/defaults/accountingDefinitions';
import { IModuleSettingsDefinitionRepository } from '../../repository/interfaces/system/IModuleSettingsDefinitionRepository';
import { IModulePermissionsDefinitionRepository } from '../../repository/interfaces/system/IModulePermissionsDefinitionRepository';

/**
 * Ensures accounting module settings and permissions definitions exist.
 * Can be invoked during startup or migration scripts.
 */
export class AccountingBootstrapService {
  constructor(
    private settingsDefRepo: IModuleSettingsDefinitionRepository,
    private permDefRepo: IModulePermissionsDefinitionRepository
  ) {}

  async ensureDefaults() {
    const settingsDef = await this.settingsDefRepo.getDefinition('accounting');
    if (!settingsDef) {
      await this.settingsDefRepo.createDefinition(accountingModuleSettingsDefinition);
    }

    const permDef = await this.permDefRepo.getByModuleId('accounting');
    if (!permDef) {
      await this.permDefRepo.create(accountingModulePermissionsDefinition);
    }
  }
}
