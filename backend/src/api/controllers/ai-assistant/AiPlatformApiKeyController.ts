/**
 * AiPlatformApiKeyController — Super Admin's API key vault endpoints.
 * Thin controller that delegates to AiPlatformApiKeyUseCase.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class AiPlatformApiKeyController {
  static async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const keys = await diContainer.aiPlatformApiKeyUseCase.list();
      res.json({ success: true, data: keys.map(k => k.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await diContainer.aiPlatformApiKeyUseCase.create({
        label: req.body.label,
        providerId: req.body.providerId,
        apiKey: req.body.apiKey,
        notes: req.body.notes,
      });
      res.status(201).json({ success: true, data: created.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await diContainer.aiPlatformApiKeyUseCase.update(req.params.keyId, {
        label: req.body.label,
        apiKey: req.body.apiKey,
        notes: req.body.notes,
      });
      res.json({ success: true, data: updated.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await diContainer.aiPlatformApiKeyUseCase.delete(req.params.keyId);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }

  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await diContainer.aiPlatformApiKeyUseCase.validate(req.params.keyId);
      res.json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }
}
