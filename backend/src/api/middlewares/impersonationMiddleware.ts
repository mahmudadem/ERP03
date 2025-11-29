
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { ValidateImpersonationSessionUseCase } from '../../application/impersonation/use-cases/ValidateImpersonationSessionUseCase';

export async function impersonationMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const impersonationToken = req.headers['x-impersonation-token'] as string;

    if (!impersonationToken) {
      return next();
    }

    const useCase = new ValidateImpersonationSessionUseCase(diContainer.impersonationRepository);
    const session = await useCase.execute(impersonationToken);

    if (!session) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired impersonation session' 
      });
    }

    // Override request context
    (req as any).impersonation = {
      active: true,
      sessionId: session.id,
      superAdminId: session.superAdminId,
      companyId: session.companyId,
      isOwner: true // Treat as owner
    };

    // Override company context
    (req as any).companyId = session.companyId;

    next();
  } catch (error) {
    next(error);
  }
}
