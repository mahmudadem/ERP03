
/**
 * SystemController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { CreateRoleUseCase } from '../../../application/system/use-cases/RoleUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class SystemController {
  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, name, permissions } = (req as any).body;
      if (!companyId || !name) throw ApiError.badRequest('CompanyID and Name required');

      const useCase = new CreateRoleUseCase(diContainer.roleRepository);
      await useCase.execute(companyId, name, permissions || []);

      (res as any).status(201).json({ success: true, message: 'Role created' });
    } catch (error) {
      next(error);
    }
  }
}
