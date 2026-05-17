import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class AiRuntimeProfileController {
  static async listProfiles(req: Request, res: Response, next: NextFunction) {
    try {
      const profiles = await diContainer.aiPlatformRuntimeProfileUseCase.listProfiles();
      res.json({ success: true, data: profiles.map(profile => profile.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await diContainer.aiPlatformRuntimeProfileUseCase.getProfile(req.params.profileId);
      res.json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async createProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await diContainer.aiPlatformRuntimeProfileUseCase.upsertProfile(req.body);
      res.status(201).json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await diContainer.aiPlatformRuntimeProfileUseCase.upsertProfile({
        ...req.body,
        id: req.params.profileId,
      });
      res.json({ success: true, data: profile.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async deleteProfile(req: Request, res: Response, next: NextFunction) {
    try {
      await diContainer.aiPlatformRuntimeProfileUseCase.deleteProfile(req.params.profileId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
