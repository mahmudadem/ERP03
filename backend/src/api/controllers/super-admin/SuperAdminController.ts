
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PromoteUserToSuperAdminUseCase } from '../../../application/super-admin/use-cases/PromoteUserToSuperAdminUseCase';
import { DemoteSuperAdminUseCase } from '../../../application/super-admin/use-cases/DemoteSuperAdminUseCase';
import { ListAllUsersUseCase } from '../../../application/super-admin/use-cases/ListAllUsersUseCase';
import { ListAllCompaniesUseCase } from '../../../application/super-admin/use-cases/ListAllCompaniesUseCase';
import { GetSystemOverviewUseCase } from '../../../application/super-admin/use-cases/GetSystemOverviewUseCase';

export class SuperAdminController {
  
  static async listAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.uid;
      const useCase = new ListAllUsersUseCase(diContainer.userRepository);
      const users = await useCase.execute(actorId);
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  static async promoteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.uid;
      const { userId } = (req as any).params;
      const useCase = new PromoteUserToSuperAdminUseCase(diContainer.userRepository);
      await useCase.execute(userId, actorId);
      res.json({ success: true, message: 'User promoted to SUPER_ADMIN' });
    } catch (error) {
      next(error);
    }
  }

  static async demoteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.uid;
      const { userId } = (req as any).params;
      const useCase = new DemoteSuperAdminUseCase(diContainer.userRepository);
      await useCase.execute(userId, actorId);
      res.json({ success: true, message: 'User demoted to USER' });
    } catch (error) {
      next(error);
    }
  }

  static async listAllCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.uid;
      const useCase = new ListAllCompaniesUseCase(
        diContainer.userRepository,
        diContainer.companyRepository
      );
      const companies = await useCase.execute(actorId);
      res.json({ success: true, data: companies });
    } catch (error) {
      next(error);
    }
  }

  static async getSystemOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const actorId = (req as any).user.uid;
      const useCase = new GetSystemOverviewUseCase(diContainer.userRepository);
      const overview = await useCase.execute(actorId);
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }

  static async getCompanyAiReportMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      const config = await diContainer.aiSettingsRepository.getConfig(companyId);
      res.json({ success: true, data: { aiReportMode: config?.aiReportMode || 'standard' } });
    } catch (error) {
      next(error);
    }
  }

  static async setCompanyAiReportMode(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      const { aiReportMode } = req.body;
      if (!['standard', 'authoritative'].includes(aiReportMode)) {
        res.status(400).json({ success: false, error: 'aiReportMode must be "standard" or "authoritative"' });
        return;
      }
      const repo = diContainer.aiSettingsRepository;
      let config = await repo.getConfig(companyId);
      if (!config) {
        const { AiProviderConfig } = await import('../../../domain/ai-assistant/entities/AiProviderConfig');
        config = AiProviderConfig.create({ companyId });
      }
      config.aiReportMode = aiReportMode;
      config.updatedAt = new Date();
      await repo.saveConfig(config);
      res.json({ success: true, data: { aiReportMode: config.aiReportMode } });
    } catch (error) {
      next(error);
    }
  }

  static async getCompanyAiCredits(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      const ledger = await diContainer.aiCreditLedgerRepository.getByCompanyId(companyId);
      const balance = ledger?.balance || 0;
      const totalPurchased = ledger?.totalPurchased || 0;
      const totalConsumed = ledger?.totalConsumed || 0;
      res.json({ success: true, data: { balance, totalPurchased, totalConsumed } });
    } catch (error) {
      next(error);
    }
  }
}
