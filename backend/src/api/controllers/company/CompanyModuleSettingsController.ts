import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleSettingsValidator } from '../../../application/module-settings/ModuleSettingsValidator';

export class CompanyModuleSettingsController {
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, moduleId } = req.params as any;

      await diContainer.companyModuleSettingsRepository.ensureModuleIsActivated(companyId, moduleId);
      const def = await diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
      const stored = await diContainer.companyModuleSettingsRepository.getSettings(companyId, moduleId);

      const result = {
        definition: def,
        settings: stored || {},
      };
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async saveSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, moduleId } = req.params as any;
      const userId = (req as any).user.uid;
      const payload = (req as any).body?.settings || {};

      await diContainer.companyModuleSettingsRepository.ensureModuleIsActivated(companyId, moduleId);
      const def = await diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
      if (!def) throw new Error('Settings definition not found');

      const validated = ModuleSettingsValidator.validate(def, payload);
      await diContainer.companyModuleSettingsRepository.saveSettings(companyId, moduleId, validated, userId);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
