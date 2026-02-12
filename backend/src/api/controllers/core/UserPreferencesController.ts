import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { GetUserPreferencesUseCase, UpsertUserPreferencesUseCase } from '../../../application/core/use-cases/UserPreferencesUseCases';

const mapDto = (prefs: any) => ({
  language: prefs?.language || 'en',
  uiMode: prefs?.uiMode || 'windows',
  theme: prefs?.theme || 'light',
  sidebarMode: prefs?.sidebarMode || 'classic',
  sidebarPinned: prefs?.sidebarPinned ?? true,
  updatedAt: prefs?.updatedAt,
  createdAt: prefs?.createdAt,
});

export class UserPreferencesController {
  static async getMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid || (req as any).userId;
      if (!userId) throw ApiError.unauthorized('Missing user');
      const useCase = new GetUserPreferencesUseCase(diContainer.userPreferencesRepository);
      const prefs = await useCase.execute(userId);
      res.status(200).json({ success: true, data: mapDto(prefs) });
    } catch (error) {
      next(error);
    }
  }

  static async upsertMyPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid || (req as any).userId;
      if (!userId) throw ApiError.unauthorized('Missing user');
      const { language, uiMode, theme, sidebarMode, sidebarPinned } = req.body || {};
      const useCase = new UpsertUserPreferencesUseCase(diContainer.userPreferencesRepository);
      const prefs = await useCase.execute(userId, { language, uiMode, theme, sidebarMode, sidebarPinned });
      res.status(200).json({ success: true, data: mapDto(prefs) });
    } catch (error) {
      next(error);
    }
  }
}

