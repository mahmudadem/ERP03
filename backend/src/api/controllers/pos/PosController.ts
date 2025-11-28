
/**
 * PosController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { OpenPOSShiftUseCase, CreatePOSOrderUseCase } from '../../../application/pos/use-cases/PosUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PosDTOMapper } from '../../dtos/PosDTOs';

export class PosController {
  static async openShift(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new OpenPOSShiftUseCase(diContainer.posShiftRepository);
      const shift = await useCase.execute((req as any).body);
      
      (res as any).status(201).json({
        success: true,
        data: PosDTOMapper.toShiftDTO(shift)
      });
    } catch (error) {
      next(error);
    }
  }

  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreatePOSOrderUseCase(diContainer.posOrderRepository);
      const order = await useCase.execute((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: PosDTOMapper.toOrderDTO(order)
      });
    } catch (error) {
      next(error);
    }
  }
}
