import { NextFunction, Request, Response } from 'express';
import {
  CreateGoodsReceiptUseCase,
  GetGoodsReceiptUseCase,
  ListGoodsReceiptsUseCase,
  PostGoodsReceiptUseCase,
} from '../../../application/purchases/use-cases/GoodsReceiptUseCases';
import {
  CancelPurchaseOrderUseCase,
  ClosePurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  GetPurchaseOrderUseCase,
  ListPurchaseOrdersUseCase,
  UpdatePurchaseOrderUseCase,
} from '../../../application/purchases/use-cases/PurchaseOrderUseCases';
import {
  CreatePurchaseInvoiceUseCase,
  GetPurchaseInvoiceUseCase,
  ListPurchaseInvoicesUseCase,
  PostPurchaseInvoiceUseCase,
  UpdatePurchaseInvoiceUseCase,
} from '../../../application/purchases/use-cases/PurchaseInvoiceUseCases';
import {
  CreatePurchaseReturnUseCase,
  GetPurchaseReturnUseCase,
  ListPurchaseReturnsUseCase,
  PostPurchaseReturnUseCase,
} from '../../../application/purchases/use-cases/PurchaseReturnUseCases';
import {
  GetPurchaseSettingsUseCase,
  InitializePurchasesUseCase,
  UpdatePurchaseSettingsUseCase,
} from '../../../application/purchases/use-cases/PurchaseSettingsUseCases';
import { UpdateInvoicePaymentStatusUseCase } from '../../../application/purchases/use-cases/PaymentSyncUseCases';
import { PurchasesInventoryService } from '../../../application/inventory/services/PurchasesInventoryService';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { GRNStatus } from '../../../domain/purchases/entities/GoodsReceipt';
import { PaymentStatus, PIStatus } from '../../../domain/purchases/entities/PurchaseInvoice';
import { POStatus } from '../../../domain/purchases/entities/PurchaseOrder';
import { PRStatus } from '../../../domain/purchases/entities/PurchaseReturn';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PurchaseDTOMapper } from '../../dtos/PurchaseDTOs';
import {
  validateCreatePurchaseReturnInput,
  validateCreateGoodsReceiptInput,
  validateCreatePurchaseInvoiceInput,
  validateCreatePurchaseOrderInput,
  validateInitializePurchasesInput,
  validateListGoodsReceiptsQuery,
  validateListPurchaseInvoicesQuery,
  validateListPurchaseOrdersQuery,
  validateListPurchaseReturnsQuery,
  validateUpdateInvoicePaymentStatusInput,
  validateUpdatePurchaseInvoiceInput,
  validateUpdatePurchaseOrderInput,
  validateUpdatePurchaseSettingsInput,
} from '../../validators/purchases.validators';

const PO_STATUSES: POStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'CLOSED',
  'CANCELLED',
];

const GRN_STATUSES: GRNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PI_STATUSES: PIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PR_STATUSES: PRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

const toOptionalNumber = (value: any): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toOptionalStatus = (value: any): POStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as POStatus;
  return PO_STATUSES.includes(status) ? status : undefined;
};

const toOptionalGRNStatus = (value: any): GRNStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as GRNStatus;
  return GRN_STATUSES.includes(status) ? status : undefined;
};

const toOptionalPIStatus = (value: any): PIStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as PIStatus;
  return PI_STATUSES.includes(status) ? status : undefined;
};

const toOptionalPaymentStatus = (value: any): PaymentStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as PaymentStatus;
  return PAYMENT_STATUSES.includes(status) ? status : undefined;
};

const toOptionalPRStatus = (value: any): PRStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as PRStatus;
  return PR_STATUSES.includes(status) ? status : undefined;
};

export class PurchaseController {
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

  private static buildMovementUseCase(): RecordStockMovementUseCase {
    return new RecordStockMovementUseCase({
      itemRepository: diContainer.itemRepository,
      warehouseRepository: diContainer.warehouseRepository,
      stockMovementRepository: diContainer.stockMovementRepository,
      stockLevelRepository: diContainer.stockLevelRepository,
      companyRepository: diContainer.companyRepository,
      transactionManager: diContainer.transactionManager,
    });
  }

  private static buildPurchasesInventoryService(): PurchasesInventoryService {
    return new PurchasesInventoryService(PurchaseController.buildMovementUseCase());
  }

  static async initializePurchases(req: Request, res: Response, next: NextFunction) {
    try {
      validateInitializePurchasesInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const userId = PurchaseController.getUserId(req);

      const useCase = new InitializePurchasesUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.accountRepository,
        diContainer.companyModuleRepository
      );

      const settings = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        userId,
      });

      (res as any).status(200).json({
        success: true,
        data: PurchaseDTOMapper.toSettingsDTO(settings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const useCase = new GetPurchaseSettingsUseCase(diContainer.purchaseSettingsRepository);
      const settings = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: settings ? PurchaseDTOMapper.toSettingsDTO(settings) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdatePurchaseSettingsInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);

      const useCase = new UpdatePurchaseSettingsUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.accountRepository
      );

      const settings = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
      });

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toSettingsDTO(settings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPO(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreatePurchaseOrderInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const userId = PurchaseController.getUserId(req);

      const useCase = new CreatePurchaseOrderUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository
      );

      const po = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listPOs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListPurchaseOrdersQuery((req as any).query);
      const companyId = PurchaseController.getCompanyId(req);

      const useCase = new ListPurchaseOrdersUseCase(diContainer.purchaseOrderRepository);
      const orders = await useCase.execute(companyId, {
        status: toOptionalStatus((req as any).query.status),
        vendorId: (req as any).query.vendorId ? String((req as any).query.vendorId) : undefined,
        dateFrom: (req as any).query.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query.dateTo ? String((req as any).query.dateTo) : undefined,
        limit: toOptionalNumber((req as any).query.limit),
        offset: toOptionalNumber((req as any).query.offset),
      });

      (res as any).json({
        success: true,
        data: orders.map((po) => PurchaseDTOMapper.toOrderDTO(po)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPurchaseOrderUseCase(diContainer.purchaseOrderRepository);
      const po = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePO(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdatePurchaseOrderInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdatePurchaseOrderUseCase(
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository
      );

      const po = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async confirmPO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new ConfirmPurchaseOrderUseCase(diContainer.purchaseOrderRepository);
      const po = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancelPO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new CancelPurchaseOrderUseCase(diContainer.purchaseOrderRepository);
      const po = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async closePO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new ClosePurchaseOrderUseCase(diContainer.purchaseOrderRepository);
      const po = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toOrderDTO(po),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createGRN(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateGoodsReceiptInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const userId = PurchaseController.getUserId(req);

      const useCase = new CreateGoodsReceiptUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.goodsReceiptRepository,
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository
      );

      const grn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: PurchaseDTOMapper.toGoodsReceiptDTO(grn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listGRNs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListGoodsReceiptsQuery((req as any).query);
      const companyId = PurchaseController.getCompanyId(req);

      const useCase = new ListGoodsReceiptsUseCase(diContainer.goodsReceiptRepository);
      const list = await useCase.execute(companyId, {
        purchaseOrderId: (req as any).query.purchaseOrderId ? String((req as any).query.purchaseOrderId) : undefined,
        status: toOptionalGRNStatus((req as any).query.status),
        limit: toOptionalNumber((req as any).query.limit),
      });

      (res as any).json({
        success: true,
        data: list.map((grn) => PurchaseDTOMapper.toGoodsReceiptDTO(grn)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getGRN(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetGoodsReceiptUseCase(diContainer.goodsReceiptRepository);
      const grn = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toGoodsReceiptDTO(grn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postGRN(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = PurchaseController.buildPurchasesInventoryService();

      const useCase = new PostGoodsReceiptUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.goodsReceiptRepository,
        diContainer.purchaseOrderRepository,
        diContainer.itemRepository,
        diContainer.warehouseRepository,
        diContainer.uomConversionRepository,
        inventoryService,
        diContainer.transactionManager
      );

      const grn = await useCase.execute(companyId, id);
      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toGoodsReceiptDTO(grn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createPI(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreatePurchaseInvoiceInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const userId = PurchaseController.getUserId(req);

      const useCase = new CreatePurchaseInvoiceUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.purchaseInvoiceRepository,
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository
      );

      const pi = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePI(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdatePurchaseInvoiceInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdatePurchaseInvoiceUseCase(
        diContainer.purchaseInvoiceRepository,
        diContainer.partyRepository
      );

      const pi = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listPIs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListPurchaseInvoicesQuery((req as any).query);
      const companyId = PurchaseController.getCompanyId(req);

      const useCase = new ListPurchaseInvoicesUseCase(diContainer.purchaseInvoiceRepository);
      const list = await useCase.execute(companyId, {
        vendorId: (req as any).query.vendorId ? String((req as any).query.vendorId) : undefined,
        purchaseOrderId: (req as any).query.purchaseOrderId ? String((req as any).query.purchaseOrderId) : undefined,
        status: toOptionalPIStatus((req as any).query.status),
        paymentStatus: toOptionalPaymentStatus((req as any).query.paymentStatus),
        limit: toOptionalNumber((req as any).query.limit),
      });

      (res as any).json({
        success: true,
        data: list.map((pi) => PurchaseDTOMapper.toPurchaseInvoiceDTO(pi)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPurchaseInvoiceUseCase(diContainer.purchaseInvoiceRepository);
      const pi = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postPI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = PurchaseController.buildPurchasesInventoryService();

      const useCase = new PostPurchaseInvoiceUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.purchaseInvoiceRepository,
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.taxCodeRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.warehouseRepository,
        diContainer.uomConversionRepository,
        diContainer.companyCurrencyRepository,
        diContainer.exchangeRateRepository,
        inventoryService,
        diContainer.voucherRepository,
        diContainer.ledgerRepository,
        diContainer.transactionManager
      );

      const pi = await useCase.execute(companyId, id);
      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseInvoiceDTO(pi),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateInvoicePaymentStatusInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const paymentAmountBase = Number((req as any).body.paymentAmountBase);

      const useCase = new UpdateInvoicePaymentStatusUseCase(diContainer.purchaseInvoiceRepository);
      const invoice = await useCase.execute(companyId, id, paymentAmountBase);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseInvoiceDTO(invoice),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createReturn(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreatePurchaseReturnInput((req as any).body);
      const companyId = PurchaseController.getCompanyId(req);
      const userId = PurchaseController.getUserId(req);

      const useCase = new CreatePurchaseReturnUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.purchaseReturnRepository,
        diContainer.purchaseInvoiceRepository,
        diContainer.goodsReceiptRepository
      );

      const purchaseReturn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseReturnDTO(purchaseReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listReturns(req: Request, res: Response, next: NextFunction) {
    try {
      validateListPurchaseReturnsQuery((req as any).query);
      const companyId = PurchaseController.getCompanyId(req);

      const useCase = new ListPurchaseReturnsUseCase(diContainer.purchaseReturnRepository);
      const list = await useCase.execute(companyId, {
        vendorId: (req as any).query.vendorId ? String((req as any).query.vendorId) : undefined,
        purchaseInvoiceId: (req as any).query.purchaseInvoiceId
          ? String((req as any).query.purchaseInvoiceId)
          : undefined,
        goodsReceiptId: (req as any).query.goodsReceiptId
          ? String((req as any).query.goodsReceiptId)
          : undefined,
        status: toOptionalPRStatus((req as any).query.status),
      });

      (res as any).json({
        success: true,
        data: list.map((entry) => PurchaseDTOMapper.toPurchaseReturnDTO(entry)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPurchaseReturnUseCase(diContainer.purchaseReturnRepository);
      const purchaseReturn = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseReturnDTO(purchaseReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PurchaseController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = PurchaseController.buildPurchasesInventoryService();

      const useCase = new PostPurchaseReturnUseCase(
        diContainer.purchaseSettingsRepository,
        diContainer.purchaseReturnRepository,
        diContainer.purchaseInvoiceRepository,
        diContainer.goodsReceiptRepository,
        diContainer.purchaseOrderRepository,
        diContainer.partyRepository,
        diContainer.taxCodeRepository,
        diContainer.itemRepository,
        diContainer.uomConversionRepository,
        diContainer.companyCurrencyRepository,
        inventoryService,
        diContainer.voucherRepository,
        diContainer.ledgerRepository,
        diContainer.transactionManager
      );

      const purchaseReturn = await useCase.execute(companyId, id);
      (res as any).json({
        success: true,
        data: PurchaseDTOMapper.toPurchaseReturnDTO(purchaseReturn),
      });
    } catch (error) {
      next(error);
    }
  }
}
