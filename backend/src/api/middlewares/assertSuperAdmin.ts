
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../infrastructure/di/bindRepositories';

export async function assertSuperAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await diContainer.userRepository.getUserById(userId);
    if (!user || !user.isAdmin()) {
      return res.status(403).json({ success: false, message: 'Forbidden: SUPER_ADMIN access required' });
    }

    next();
  } catch (error) {
    next(error);
  }
}
