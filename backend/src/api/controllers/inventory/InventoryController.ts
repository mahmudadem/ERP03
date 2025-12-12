
/**
 * InventoryController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { CreateItemUseCase } from '../../../application/inventory/use-cases/ItemUseCases';
import { CreateWarehouseUseCase } from '../../../application/inventory/use-cases/WarehouseUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { InventoryDTOMapper } from '../../dtos/InventoryDTOs';
import { validateCreateItemInput } from '../../validators/inventory.validators';

export class InventoryController {
  static async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateItemInput((req as any).body);

      const useCase = new CreateItemUseCase(diContainer.itemRepository);
      const item = await useCase.execute((req as any).body);

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toItemDTO(item)
      });
    } catch (error) {
      next(error);
    }
  }

  static async listItems(req: Request, res: Response, next: NextFunction) {
      try {
          // Quick implementation: Direct repository or dedicated Use Case
          // Using repository directly for read-only to save time/complexity if use-case missing
          const companyId = (req as any).user.companyId;
          const items = await diContainer.itemRepository.getCompanyItems(companyId);
          
          (res as any).json({
            success: true,
            data: items.map(InventoryDTOMapper.toItemDTO)
          });
      } catch (error) {
          next(error);
      }
  }

  static async createWarehouse(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateWarehouseUseCase(diContainer.warehouseRepository);
      await useCase.execute((req as any).body);
      (res as any).status(201).json({ success: true, message: 'Warehouse created' });
    } catch (error) {
      next(error);
    }
  }
}
