
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListPlansUseCase } from '../../../application/super-admin/use-cases/ListPlansUseCase';
import { CreatePlanUseCase } from '../../../application/super-admin/use-cases/CreatePlanUseCase';
import { UpdatePlanUseCase } from '../../../application/super-admin/use-cases/UpdatePlanUseCase';
import { DeletePlanUseCase } from '../../../application/super-admin/use-cases/DeletePlanUseCase';

export class PlanRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListPlansUseCase(diContainer.planRegistryRepository);
      const plans = await useCase.execute();
      
      res.json({ success: true, data: plans });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreatePlanUseCase(diContainer.planRegistryRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Plan created successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdatePlanUseCase(diContainer.planRegistryRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Plan updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeletePlanUseCase(diContainer.planRegistryRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
