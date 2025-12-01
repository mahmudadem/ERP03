
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { StartImpersonationUseCase } from '../../../application/impersonation/use-cases/StartImpersonationUseCase';
import { StopImpersonationUseCase } from '../../../application/impersonation/use-cases/StopImpersonationUseCase';

export class ImpersonationController {
  
  static async startImpersonation(req: Request, res: Response, next: NextFunction) {
    try {
      const superAdminId = (req as any).user.uid;
      const { companyId } = (req as any).body;

      if (!companyId) {
        return res.status(400).json({ success: false, message: 'companyId is required' });
      }

      const useCase = new StartImpersonationUseCase(
        diContainer.userRepository,
        diContainer.impersonationRepository
      );

      const impersonationToken = await useCase.execute(superAdminId, companyId);

      return res.json({ 
        success: true, 
        data: { 
          impersonationToken,
          companyId 
        } 
      });
    } catch (error) {
      return next(error);
    }
  }

  static async stopImpersonation(req: Request, res: Response, next: NextFunction) {
    try {
      const superAdminId = (req as any).user.uid;

      const useCase = new StopImpersonationUseCase(
        diContainer.userRepository,
        diContainer.impersonationRepository
      );

      await useCase.execute(superAdminId);

      return res.json({ success: true, message: 'Impersonation stopped' });
    } catch (error) {
      return next(error);
    }
  }

  static async getImpersonationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const superAdminId = (req as any).user.uid;

      const session = await diContainer.impersonationRepository.getActiveSessionBySuperAdmin(superAdminId);

      if (!session) {
        return res.json({ success: true, data: { active: false } });
      }

      return res.json({ 
        success: true, 
        data: { 
          active: true,
          sessionId: session.id,
          companyId: session.companyId,
          createdAt: session.createdAt
        } 
      });
    } catch (error) {
      return next(error);
    }
  }
}
