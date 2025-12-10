
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListPermissionsUseCase } from '../../../application/super-admin/use-cases/ListPermissionsUseCase';
import { CreatePermissionUseCase } from '../../../application/super-admin/use-cases/CreatePermissionUseCase';
import { UpdatePermissionUseCase } from '../../../application/super-admin/use-cases/UpdatePermissionUseCase';
import { DeletePermissionUseCase } from '../../../application/super-admin/use-cases/DeletePermissionUseCase';

export class PermissionRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListPermissionsUseCase(diContainer.permissionRegistryRepository);
      const permissions = await useCase.execute();
      
      res.json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreatePermissionUseCase(diContainer.permissionRegistryRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Permission created successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdatePermissionUseCase(diContainer.permissionRegistryRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Permission updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeletePermissionUseCase(diContainer.permissionRegistryRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Permission deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
