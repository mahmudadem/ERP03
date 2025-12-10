
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListRoleTemplatesUseCase } from '../../../application/super-admin/use-cases/ListRoleTemplatesUseCase';
import { CreateRoleTemplateUseCase } from '../../../application/super-admin/use-cases/CreateRoleTemplateUseCase';
import { UpdateRoleTemplateUseCase } from '../../../application/super-admin/use-cases/UpdateRoleTemplateUseCase';
import { DeleteRoleTemplateUseCase } from '../../../application/super-admin/use-cases/DeleteRoleTemplateUseCase';

export class RoleTemplateRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListRoleTemplatesUseCase(diContainer.roleTemplateRegistryRepository);
      const roleTemplates = await useCase.execute();
      
      res.json({ success: true, data: roleTemplates });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { GetRoleTemplateByIdUseCase } = require('../../../application/super-admin/use-cases/GetRoleTemplateByIdUseCase');
      const useCase = new GetRoleTemplateByIdUseCase(diContainer.roleTemplateRegistryRepository);
      const roleTemplate = await useCase.execute(req.params.id);
      
      if (!roleTemplate) {
        res.status(404).json({ success: false, message: 'Role template not found' });
        return;
      }

      res.json({ success: true, data: roleTemplate });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateRoleTemplateUseCase(diContainer.roleTemplateRegistryRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Role template created successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdateRoleTemplateUseCase(diContainer.roleTemplateRegistryRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Role template updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeleteRoleTemplateUseCase(diContainer.roleTemplateRegistryRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Role template deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
