import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  AssignVendorToGroupUseCase,
  CreateVendorGroupUseCase,
  DeleteVendorGroupUseCase,
  GetVendorGroupUseCase,
  ListVendorGroupsUseCase,
  UpdateVendorGroupUseCase,
} from '../../../application/purchases/use-cases/VendorGroupUseCases';
import {
  CreatePurchasePriceListUseCase,
  UpdatePurchasePriceListUseCase,
  DeletePurchasePriceListUseCase,
  GetPurchasePriceListUseCase,
  ListPurchasePriceListsUseCase,
  GetEffectivePurchasePriceUseCase,
} from '../../../application/purchases/use-cases/PurchasePriceListUseCases';

export class PurchaseMasterDataController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }
    return companyId;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  // --- Vendor Groups ---

  static async createVendorGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const userId = PurchaseMasterDataController.getUserId(req);
      const useCase = new CreateVendorGroupUseCase(diContainer.vendorGroupRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });
      (res as any).status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updateVendorGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new UpdateVendorGroupUseCase(diContainer.vendorGroupRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async deleteVendorGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new DeleteVendorGroupUseCase(
        diContainer.vendorGroupRepository,
        diContainer.partyRepository
      );
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getVendorGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new GetVendorGroupUseCase(diContainer.vendorGroupRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listVendorGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListVendorGroupsUseCase(diContainer.vendorGroupRepository);
      const results = await useCase.execute(companyId, {
        status: q.status as 'ACTIVE' | 'INACTIVE' | undefined,
        includeInactive: String(q.includeInactive) === 'true',
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async assignVendorToGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new AssignVendorToGroupUseCase(
        diContainer.vendorGroupRepository,
        diContainer.partyRepository
      );
      await useCase.execute({
        companyId,
        vendorId: (req as any).body.vendorId,
        vendorGroupId: (req as any).body.vendorGroupId,
      });
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // --- Purchase Price Lists ---

  static async createPurchasePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const userId = PurchaseMasterDataController.getUserId(req);
      const useCase = new CreatePurchasePriceListUseCase(
        diContainer.purchasePriceListRepository,
        diContainer.transactionManager
      );
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });
      (res as any).status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updatePurchasePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new UpdatePurchasePriceListUseCase(
        diContainer.purchasePriceListRepository,
        diContainer.transactionManager
      );
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async deletePurchasePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new DeletePurchasePriceListUseCase(diContainer.purchasePriceListRepository);
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getPurchasePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const useCase = new GetPurchasePriceListUseCase(diContainer.purchasePriceListRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listPurchasePriceLists(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListPurchasePriceListsUseCase(diContainer.purchasePriceListRepository);
      const results = await useCase.execute(companyId, {
        currency: q.currency as string | undefined,
        status: q.status as 'ACTIVE' | 'INACTIVE' | undefined,
        includeInactive: String(q.includeInactive) === 'true',
        limit: q.limit ? Number(q.limit) : undefined,
        offset: q.offset ? Number(q.offset) : undefined,
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getEffectivePurchasePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      if (!q.vendorId || !q.itemId) {
        throw new Error('vendorId and itemId query parameters are required');
      }
      const useCase = new GetEffectivePurchasePriceUseCase(
        diContainer.purchasePriceListRepository,
        diContainer.partyRepository
      );
      const result = await useCase.execute({
        companyId,
        vendorId: q.vendorId as string,
        itemId: q.itemId as string,
        qty: q.qty ? Number(q.qty) : 1,
        asOfDate: q.asOfDate ? new Date(q.asOfDate as string) : undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
