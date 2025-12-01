
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../infrastructure/di/bindRepositories';

export async function assertSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Guardrail: only enforce on super-admin routes
    if (!req.originalUrl.includes('/super-admin')) {
      return next();
    }

    // Never block auth self-check endpoints
    if (req.path.startsWith('/auth/me/')) {
      return next();
    }

    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await diContainer.userRepository.getUserById(userId);
    if (!user || !user.isAdmin()) {
      return res.status(403).json({ success: false, message: 'Forbidden: SUPER_ADMIN access required' });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
