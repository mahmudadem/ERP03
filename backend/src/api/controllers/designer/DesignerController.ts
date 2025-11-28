
/**
 * DesignerController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { CreateFormDefinitionUseCase, CreateVoucherTypeDefinitionUseCase } from '../../../application/designer/use-cases/DesignerUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class DesignerController {
  static async createForm(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateFormDefinitionUseCase(diContainer.formDefinitionRepository);
      await useCase.execute((req as any).body);
      (res as any).status(201).json({ success: true, message: 'Form definition saved' });
    } catch (error) {
      next(error);
    }
  }

  static async createVoucherType(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateVoucherTypeDefinitionUseCase(diContainer.voucherTypeDefinitionRepository);
      await useCase.execute((req as any).body);
      (res as any).status(201).json({ success: true, message: 'Voucher type saved' });
    } catch (error) {
      next(error);
    }
  }
}
