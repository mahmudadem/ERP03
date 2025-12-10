
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListBusinessDomainsUseCase } from '../../../application/super-admin/use-cases/ListBusinessDomainsUseCase';
import { CreateBusinessDomainUseCase } from '../../../application/super-admin/use-cases/CreateBusinessDomainUseCase';
import { UpdateBusinessDomainUseCase } from '../../../application/super-admin/use-cases/UpdateBusinessDomainUseCase';
import { DeleteBusinessDomainUseCase } from '../../../application/super-admin/use-cases/DeleteBusinessDomainUseCase';

export class BusinessDomainRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListBusinessDomainsUseCase(diContainer.businessDomainRepository);
      const domains = await useCase.execute();
      
      res.json({ success: true, data: domains });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateBusinessDomainUseCase(diContainer.businessDomainRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Business domain created successfully' });
    } catch (error) {
      console.error('[BusinessDomainRegistryController] Create error:', error);
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdateBusinessDomainUseCase(diContainer.businessDomainRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Business domain updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeleteBusinessDomainUseCase(diContainer.businessDomainRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Business domain deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
