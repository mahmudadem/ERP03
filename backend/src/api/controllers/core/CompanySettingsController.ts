
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { CompanySettingsDTOMapper } from '../../dtos/CompanySettingsDTO';

export class CompanySettingsController {
  
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');

      const settings = await diContainer.companySettingsRepository.getSettings(companyId);
      
      (res as any).status(200).json({
        success: true,
        data: CompanySettingsDTOMapper.toDTO(settings)
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');

      const { strictApprovalMode } = (req as any).body;
      
      await diContainer.companySettingsRepository.updateSettings(companyId, {
        strictApprovalMode
      });

      (res as any).status(200).json({
        success: true,
        message: 'Settings updated'
      });
    } catch (error) {
      next(error);
    }
  }
}
