import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { InventoryDTOMapper } from '../../dtos/InventoryDTOs';

// We reuse the inventory validators for now since the Item entity hasn't structurally changed.
import { validateCreateItemInput, validateUpdateItemInput } from '../../validators/inventory.validators';

export class CatalogController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).company?.id;
    if (!companyId) throw new Error('Company context missing');
    return companyId;
  }

  private static getUserId(req: Request): string {
    const userId = (req as any).user?.uid;
    if (!userId) throw new Error('User context missing');
    return userId;
  }

  static async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateItemInput((req as any).body);
      const companyId = CatalogController.getCompanyId(req);
      const userId = CatalogController.getUserId(req);

      const item = await diContainer.catalogCore.createItem({
        ...(req as any).body,
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: InventoryDTOMapper.toItemDTO(item),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listItems(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = CatalogController.getCompanyId(req);
      const items = await diContainer.catalogCore.listItems(companyId, {
        type: (req as any).query.type,
        categoryId: (req as any).query.categoryId,
        active: (req as any).query.active === undefined ? undefined : (req as any).query.active === 'true',
      });

      (res as any).json({
        success: true,
        data: items.map(InventoryDTOMapper.toItemDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async searchItems(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = CatalogController.getCompanyId(req);
      const query = String((req as any).query.q || '');
      const items = await diContainer.catalogCore.searchItems(companyId, query, {
        trackInventory: (req as any).query.trackInventory === undefined
          ? undefined
          : String((req as any).query.trackInventory) === 'true',
        limit: (req as any).query.limit ? Number((req as any).query.limit) : 50,
        offset: (req as any).query.offset ? Number((req as any).query.offset) : 0,
      });

      (res as any).json({
        success: true,
        data: items.map(InventoryDTOMapper.toItemDTO),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getItem(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await diContainer.catalogCore.getItem((req as any).params.id);
      (res as any).json({
        success: true,
        data: item ? InventoryDTOMapper.toItemDTO(item) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateItemInput((req as any).body);
      const item = await diContainer.catalogCore.updateItem((req as any).params.id, (req as any).body);
      (res as any).json({
        success: true,
        data: InventoryDTOMapper.toItemDTO(item),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      await diContainer.catalogCore.deleteItem((req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}
