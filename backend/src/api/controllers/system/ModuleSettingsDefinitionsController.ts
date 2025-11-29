import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleSettingsDefinition } from '../../../domain/system/ModuleSettingsDefinition';

export class ModuleSettingsDefinitionsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const defs = await diContainer.moduleSettingsDefinitionRepository.listDefinitions();
      res.json({ success: true, data: defs });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      const def = await diContainer.moduleSettingsDefinitionRepository.getDefinition(moduleId);
      res.json({ success: true, data: def });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as ModuleSettingsDefinition;
      await diContainer.moduleSettingsDefinitionRepository.createDefinition({
        ...body,
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      const body = req.body as Partial<ModuleSettingsDefinition>;
      await diContainer.moduleSettingsDefinitionRepository.updateDefinition(moduleId, {
        ...body,
        updatedAt: new Date(),
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      await diContainer.moduleSettingsDefinitionRepository.deleteDefinition(moduleId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
