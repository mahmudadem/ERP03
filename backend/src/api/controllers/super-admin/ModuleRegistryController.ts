
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListModulesUseCase } from '../../../application/super-admin/use-cases/ListModulesUseCase';
import { CreateModuleUseCase } from '../../../application/super-admin/use-cases/CreateModuleUseCase';
import { UpdateModuleUseCase } from '../../../application/super-admin/use-cases/UpdateModuleUseCase';
import { DeleteModuleUseCase } from '../../../application/super-admin/use-cases/DeleteModuleUseCase';

export class ModuleRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListModulesUseCase(diContainer.moduleRegistryRepository);
      const modules = await useCase.execute();
      
      res.json({ success: true, data: modules });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateModuleUseCase(diContainer.moduleRegistryRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Module created successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdateModuleUseCase(diContainer.moduleRegistryRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Module updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeleteModuleUseCase(diContainer.moduleRegistryRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Module deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
