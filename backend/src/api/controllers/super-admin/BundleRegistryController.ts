
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListBundlesUseCase } from '../../../application/super-admin/use-cases/ListBundlesUseCase';
import { CreateBundleUseCase } from '../../../application/super-admin/use-cases/CreateBundleUseCase';
import { UpdateBundleUseCase } from '../../../application/super-admin/use-cases/UpdateBundleUseCase';
import { DeleteBundleUseCase } from '../../../application/super-admin/use-cases/DeleteBundleUseCase';

export class BundleRegistryController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListBundlesUseCase(diContainer.bundleRegistryRepository);
      const bundles = await useCase.execute();
      
      res.json({ success: true, data: bundles });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateBundleUseCase(diContainer.bundleRegistryRepository);
      await useCase.execute(req.body);
      
      res.status(201).json({ success: true, message: 'Bundle created successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new UpdateBundleUseCase(diContainer.bundleRegistryRepository);
      await useCase.execute({ id: req.params.id, ...req.body });
      
      res.json({ success: true, message: 'Bundle updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeleteBundleUseCase(diContainer.bundleRegistryRepository);
      await useCase.execute(req.params.id);
      
      res.json({ success: true, message: 'Bundle deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
