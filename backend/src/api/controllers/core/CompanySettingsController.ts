
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { CompanySettingsDTOMapper } from '../../dtos/CompanySettingsDTO';

export class CompanySettingsController {
  private static resolveCompanyId(req: Request): string | null {
    const user = (req as any).user;
    const contextCompanyId = (req as any).companyId || user?.companyId;

    if (contextCompanyId) {
      return contextCompanyId;
    }

    if (user?.isSuperAdmin === true) {
      return (req.query.companyId as string) || (req.body as any)?.companyId || null;
    }

    return null;
  }
  
  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = CompanySettingsController.resolveCompanyId(req);
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
      const companyId = CompanySettingsController.resolveCompanyId(req);
      if (!companyId) throw ApiError.badRequest('Company Context Missing');

      const {
        strictApprovalMode,
        uiMode,
        timezone,
        dateFormat,
        language,
        baseCurrency,
        fiscalYearStart,
        fiscalYearEnd,
        exchangeGainLossAccountId,
        disabledNotificationCategories
      } = (req as any).body;
      
      await diContainer.companySettingsRepository.updateSettings(companyId, {
        strictApprovalMode,
        uiMode,
        timezone,
        dateFormat,
        language,
        baseCurrency,
        fiscalYearStart,
        fiscalYearEnd,
        exchangeGainLossAccountId,
        disabledNotificationCategories
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
