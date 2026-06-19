import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreatePriceListUseCase,
  UpdatePriceListUseCase,
  DeletePriceListUseCase,
  GetPriceListUseCase,
  ListPriceListsUseCase,
  GetEffectivePriceUseCase,
} from '../../../application/sales/use-cases/PriceListUseCases';
import {
  CreateCustomerGroupUseCase,
  UpdateCustomerGroupUseCase,
  DeleteCustomerGroupUseCase,
  GetCustomerGroupUseCase,
  ListCustomerGroupsUseCase,
  AssignCustomerToGroupUseCase,
} from '../../../application/sales/use-cases/CustomerGroupUseCases';
import {
  CreateSalespersonUseCase,
  UpdateSalespersonUseCase,
  DeleteSalespersonUseCase,
  GetSalespersonUseCase,
  ListSalespersonsUseCase,
} from '../../../application/sales/use-cases/SalespersonUseCases';
import {
  AccrueCommissionForInvoiceUseCase,
  MarkCommissionPaidUseCase,
  CancelCommissionUseCase,
  ListCommissionsUseCase,
  GetSalespersonCommissionTotalsUseCase,
  GetCommissionEntryUseCase,
} from '../../../application/sales/use-cases/CommissionUseCases';

export class SalesMasterDataController {
  private static normalizePriceSource(value: unknown):
    | 'PRICE_LIST'
    | 'LAST_PARTY_PRICE'
    | 'LAST_EVENT'
    | 'ITEM_DEFAULT'
    | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (
      value === 'PRICE_LIST' ||
      value === 'LAST_PARTY_PRICE' ||
      value === 'LAST_EVENT' ||
      value === 'ITEM_DEFAULT'
    ) {
      return value;
    }
    throw new Error('priceSource must be PRICE_LIST, LAST_PARTY_PRICE, LAST_EVENT or ITEM_DEFAULT');
  }

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

  // ---------------------------------------------------------------------------
  // PriceList handlers
  // ---------------------------------------------------------------------------

  static async createPriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const userId = SalesMasterDataController.getUserId(req);
      const useCase = new CreatePriceListUseCase(
        diContainer.priceListRepository,
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

  static async updatePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new UpdatePriceListUseCase(
        diContainer.priceListRepository,
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

  static async deletePriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new DeletePriceListUseCase(diContainer.priceListRepository);
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getPriceList(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new GetPriceListUseCase(diContainer.priceListRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listPriceLists(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListPriceListsUseCase(diContainer.priceListRepository);
      const results = await useCase.execute(companyId, {
        currency: q.currency as string | undefined,
        status: q.status as 'ACTIVE' | 'INACTIVE' | undefined,
        includeInactive: String(q.includeInactive) === 'true',
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getEffectivePrice(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new GetEffectivePriceUseCase(
        diContainer.priceListRepository,
        diContainer.partyRepository,
        diContainer.partyItemPriceRepository,
        diContainer.itemRepository,
        diContainer.inventorySettingsRepository,
        diContainer.salesSettingsRepository,
        diContainer.uomConversionRepository
      );
      const result = await useCase.execute({
        companyId,
        customerId: q.customerId as string,
        itemId: q.itemId as string,
        qty: q.qty ? Number(q.qty) : 1,
        asOfDate: q.asOfDate ? new Date(q.asOfDate as string) : undefined,
        currency: q.currency as string | undefined,
        exchangeRate: q.exchangeRate ? Number(q.exchangeRate) : undefined,
        uomId: q.uomId as string | undefined,
        uom: q.uom as string | undefined,
        priceSource: SalesMasterDataController.normalizePriceSource(q.priceSource),
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // CustomerGroup handlers
  // ---------------------------------------------------------------------------

  static async createCustomerGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const userId = SalesMasterDataController.getUserId(req);
      const useCase = new CreateCustomerGroupUseCase(
        diContainer.customerGroupRepository,
        diContainer.priceListRepository
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

  static async updateCustomerGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new UpdateCustomerGroupUseCase(
        diContainer.customerGroupRepository,
        diContainer.priceListRepository
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

  static async deleteCustomerGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new DeleteCustomerGroupUseCase(
        diContainer.customerGroupRepository,
        diContainer.partyRepository
      );
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getCustomerGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new GetCustomerGroupUseCase(diContainer.customerGroupRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listCustomerGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListCustomerGroupsUseCase(diContainer.customerGroupRepository);
      const results = await useCase.execute(companyId, {
        status: q.status as 'ACTIVE' | 'INACTIVE' | undefined,
        includeInactive: String(q.includeInactive) === 'true',
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async assignCustomerToGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new AssignCustomerToGroupUseCase(
        diContainer.customerGroupRepository,
        diContainer.partyRepository
      );
      await useCase.execute({
        companyId,
        customerId: (req as any).body.customerId,
        customerGroupId: (req as any).body.customerGroupId,
      });
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Salesperson handlers
  // ---------------------------------------------------------------------------

  static async createSalesperson(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const userId = SalesMasterDataController.getUserId(req);
      const useCase = new CreateSalespersonUseCase(diContainer.salespersonRepository);
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

  static async updateSalesperson(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new UpdateSalespersonUseCase(diContainer.salespersonRepository);
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

  static async deleteSalesperson(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new DeleteSalespersonUseCase(
        diContainer.salespersonRepository,
        diContainer.commissionEntryRepository
      );
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getSalesperson(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new GetSalespersonUseCase(diContainer.salespersonRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listSalespersons(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListSalespersonsUseCase(diContainer.salespersonRepository);
      const results = await useCase.execute(companyId, {
        status: q.status as 'ACTIVE' | 'INACTIVE' | undefined,
        includeInactive: String(q.includeInactive) === 'true',
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Commission handlers
  // ---------------------------------------------------------------------------

  static async accrueCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const userId = SalesMasterDataController.getUserId(req);
      const useCase = new AccrueCommissionForInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.salespersonRepository,
        diContainer.commissionEntryRepository
      );
      const result = await useCase.execute({
        companyId,
        invoiceId: (req as any).body.invoiceId,
        createdBy: userId,
      });
      (res as any).status(201).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async markCommissionPaid(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new MarkCommissionPaidUseCase(diContainer.commissionEntryRepository);
      const result = await useCase.execute({
        companyId,
        commissionEntryId: (req as any).params.id,
        ...((req as any).body || {}),
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async cancelCommission(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new CancelCommissionUseCase(diContainer.commissionEntryRepository);
      const result = await useCase.execute({
        companyId,
        commissionEntryId: (req as any).params.id,
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async listCommissions(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListCommissionsUseCase(diContainer.commissionEntryRepository);
      const results = await useCase.execute(companyId, {
        salespersonId: q.salespersonId as string | undefined,
        status: q.status as 'ACCRUED' | 'PAID' | 'CANCELLED' | undefined,
        sourceId: q.sourceId as string | undefined,
        fromDate: q.fromDate as string | undefined,
        toDate: q.toDate as string | undefined,
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getCommissionEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new GetCommissionEntryUseCase(diContainer.commissionEntryRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async getSalespersonCommissionTotals(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesMasterDataController.getCompanyId(req);
      const useCase = new GetSalespersonCommissionTotalsUseCase(
        diContainer.commissionEntryRepository
      );
      const result = await useCase.execute(companyId, (req as any).params.salespersonId);
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
