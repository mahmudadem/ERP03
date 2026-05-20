import { NextFunction, Request, Response } from 'express';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { SalesInventoryService } from '../../../application/inventory/services/SalesInventoryService';
import {
  CreateDeliveryNoteUseCase,
  GetDeliveryNoteUseCase,
  ListDeliveryNotesUseCase,
  PostDeliveryNoteUseCase,
  UpdateDeliveryNoteUseCase,
} from '../../../application/sales/use-cases/DeliveryNoteUseCases';
import {
  CreateSalesInvoiceUseCase,
  CreateAndPostSalesInvoiceUseCase,
  GetSalesInvoiceUseCase,
  GetInvoiceableLinkedSalesSourceUseCase,
  ListSalesInvoicesUseCase,
  PostSalesInvoiceUseCase,
  UpdateSalesInvoiceUseCase,
  UpdateAndPostSalesInvoiceUseCase,
} from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import {
  RecordSalesInvoicePaymentUseCase,
  UpdateSalesInvoicePaymentStatusUseCase,
} from '../../../application/sales/use-cases/PaymentSyncUseCases';
import {
  CancelSalesOrderUseCase,
  CloseSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  GetSalesOrderUseCase,
  ListSalesOrdersUseCase,
  UpdateSalesOrderUseCase,
} from '../../../application/sales/use-cases/SalesOrderUseCases';
import {
  GetSalesSettingsUseCase,
  InitializeSalesUseCase,
  UpdateSalesSettingsUseCase,
} from '../../../application/sales/use-cases/SalesSettingsUseCases';
import {
  CreateSalesReturnUseCase,
  GetSalesReturnUseCase,
  ListSalesReturnsUseCase,
  PostSalesReturnUseCase,
  UpdateSalesReturnUseCase,
} from '../../../application/sales/use-cases/SalesReturnUseCases';
import { DNStatus } from '../../../domain/sales/entities/DeliveryNote';
import { PaymentStatus, SIStatus } from '../../../domain/sales/entities/SalesInvoice';
import { SOStatus } from '../../../domain/sales/entities/SalesOrder';
import { SRStatus } from '../../../domain/sales/entities/SalesReturn';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { SalesDTOMapper } from '../../dtos/SalesDTOs';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
import { InitializeAccountingUseCase } from '../../../application/accounting/use-cases/InitializeAccountingUseCase';
import { EnsureAccountingEngineInitialized } from '../../../application/accounting/use-cases/EnsureAccountingEngineInitialized';
import {
  validateCreateDeliveryNoteInput,
  validateCreateSalesReturnInput,
  validateCreateSalesInvoiceInput,
  validateCreateSalesOrderInput,
  validateInitializeSalesInput,
  validateListDeliveryNotesQuery,
  validateListSalesInvoicesQuery,
  validateListSalesOrdersQuery,
  validateListSalesReturnsQuery,
  validateUpdateSalesInvoiceInput,
  validateUpdateSalesReturnInput,
  validateUpdateDeliveryNoteInput,
  validateRecordSalesInvoicePaymentInput,
  validateUpdateSalesInvoicePaymentStatusInput,
  validateUpdateSalesOrderInput,
  validateUpdateSalesSettingsInput,
} from '../../validators/sales.validators';

const SO_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const DN_STATUSES: DNStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SI_STATUSES: SIStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const SR_STATUSES: SRStatus[] = ['DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PARTIALLY_PAID', 'PAID'];

const toOptionalNumber = (value: any): number | undefined => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toOptionalStatus = (value: any): SOStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as SOStatus;
  return SO_STATUSES.includes(status) ? status : undefined;
};

const toOptionalDNStatus = (value: any): DNStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as DNStatus;
  return DN_STATUSES.includes(status) ? status : undefined;
};

const toOptionalSIStatus = (value: any): SIStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as SIStatus;
  return SI_STATUSES.includes(status) ? status : undefined;
};

const toOptionalSRStatus = (value: any): SRStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as SRStatus;
  return SR_STATUSES.includes(status) ? status : undefined;
};

const toOptionalPaymentStatus = (value: any): PaymentStatus | undefined => {
  if (!value) return undefined;
  const status = String(value).toUpperCase() as PaymentStatus;
  return PAYMENT_STATUSES.includes(status) ? status : undefined;
};

export class SalesController {
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
      inventorySettingsRepository: diContainer.inventorySettingsRepository,
      transactionManager: diContainer.transactionManager,
    });
  }

  private static buildSalesInventoryService(): SalesInventoryService {
    return new SalesInventoryService(SalesController.buildMovementUseCase());
  }

  private static buildAccountingPostingService(validateAccounts: boolean = false): SubledgerVoucherPostingService {
    if (validateAccounts) {
      return new SubledgerVoucherPostingService(
        diContainer.voucherRepository,
        diContainer.ledgerRepository,
        diContainer.companyCurrencyRepository,
        diContainer.accountRepository,
        new VoucherValidationService()
      );
    }

    return new SubledgerVoucherPostingService(
      diContainer.voucherRepository,
      diContainer.ledgerRepository,
      diContainer.companyCurrencyRepository
    );
  }

  private static buildPostSalesInvoiceUseCase(): PostSalesInvoiceUseCase {
    const inventoryService = SalesController.buildSalesInventoryService();
    const accountingPostingService = SalesController.buildAccountingPostingService(true);

    return new PostSalesInvoiceUseCase(
      diContainer.salesSettingsRepository,
      diContainer.inventorySettingsRepository,
      diContainer.salesInvoiceRepository,
      diContainer.salesOrderRepository,
      diContainer.deliveryNoteRepository,
      diContainer.partyRepository,
      diContainer.taxCodeRepository,
      diContainer.itemRepository,
      diContainer.itemCategoryRepository,
      diContainer.warehouseRepository,
      diContainer.uomConversionRepository,
      diContainer.companyCurrencyRepository,
      inventoryService,
      diContainer.companyModuleRepository,
      accountingPostingService,
      diContainer.accountRepository,
      diContainer.transactionManager,
      diContainer.paymentHistoryRepository,
      diContainer.voucherRepository,
      diContainer.voucherSequenceRepository,
      diContainer.ledgerRepository,
      diContainer.postingLogRepository
    );
  }

  static async initializeSales(req: Request, res: Response, next: NextFunction) {
    try {
      validateInitializeSalesInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const initializeAccountingUseCase = new InitializeAccountingUseCase(
        diContainer.companyModuleRepository,
        diContainer.accountRepository,
        diContainer.systemMetadataRepository,
        diContainer.companyModuleSettingsRepository,
        diContainer.companySettingsRepository,
        diContainer.currencyRepository,
        diContainer.companyRepository,
        diContainer.fiscalYearRepository,
        diContainer.voucherTypeDefinitionRepository,
        diContainer.voucherFormRepository
      );

      const ensureAccountingEngine = new EnsureAccountingEngineInitialized(
        diContainer.companyModuleRepository,
        diContainer.companyRepository,
        initializeAccountingUseCase
      );

      const useCase = new InitializeSalesUseCase(
        diContainer.salesSettingsRepository,
        diContainer.accountRepository,
        diContainer.companyModuleRepository,
        diContainer.voucherTypeDefinitionRepository,
        diContainer.voucherFormRepository,
        ensureAccountingEngine,
        diContainer.inventorySettingsRepository
      );

      const settings = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        userId,
      });

      (res as any).status(200).json({
        success: true,
        data: SalesDTOMapper.toSettingsDTO(settings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const useCase = new GetSalesSettingsUseCase(
        diContainer.salesSettingsRepository,
        diContainer.voucherTypeDefinitionRepository,
        diContainer.voucherFormRepository
      );
      const settings = await useCase.execute(companyId);

      (res as any).json({
        success: true,
        data: settings ? SalesDTOMapper.toSettingsDTO(settings) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesSettingsInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);

      const useCase = new UpdateSalesSettingsUseCase(
        diContainer.salesSettingsRepository,
        diContainer.accountRepository,
        diContainer.voucherTypeDefinitionRepository,
        diContainer.voucherFormRepository,
        diContainer.salesOrderRepository,
        diContainer.deliveryNoteRepository,
        diContainer.inventorySettingsRepository
      );

      const settings = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
      });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSettingsDTO(settings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSO(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateSalesOrderInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const useCase = new CreateSalesOrderUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository
      );

      const so = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listSOs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListSalesOrdersQuery((req as any).query);
      const companyId = SalesController.getCompanyId(req);

      const useCase = new ListSalesOrdersUseCase(diContainer.salesOrderRepository);
      const orders = await useCase.execute(companyId, {
        status: toOptionalStatus((req as any).query.status),
        customerId: (req as any).query.customerId ? String((req as any).query.customerId) : undefined,
        dateFrom: (req as any).query.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query.dateTo ? String((req as any).query.dateTo) : undefined,
        limit: toOptionalNumber((req as any).query.limit),
        offset: toOptionalNumber((req as any).query.offset),
      });

      (res as any).json({
        success: true,
        data: orders.map((order) => SalesDTOMapper.toOrderDTO(order)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetSalesOrderUseCase(diContainer.salesOrderRepository);
      const so = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getInvoiceableLinkedSource(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const salesOrderId = String((req as any).params.id);
      const useCase = new GetInvoiceableLinkedSalesSourceUseCase(
        diContainer.salesOrderRepository,
        diContainer.deliveryNoteRepository,
        diContainer.salesInvoiceRepository
      );
      const source = await useCase.execute(companyId, salesOrderId);

      (res as any).json({
        success: true,
        data: source,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSO(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesOrderInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdateSalesOrderUseCase(
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository
      );

      const so = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async confirmSO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new ConfirmSalesOrderUseCase(diContainer.salesOrderRepository);
      const so = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancelSO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new CancelSalesOrderUseCase(diContainer.salesOrderRepository);
      const so = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async closeSO(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new CloseSalesOrderUseCase(diContainer.salesOrderRepository);
      const so = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(so),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDN(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateDeliveryNoteInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const useCase = new CreateDeliveryNoteUseCase(
        diContainer.salesSettingsRepository,
        diContainer.deliveryNoteRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository
      );

      const dn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toDeliveryNoteDTO(dn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listDNs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListDeliveryNotesQuery((req as any).query);
      const companyId = SalesController.getCompanyId(req);

      const useCase = new ListDeliveryNotesUseCase(diContainer.deliveryNoteRepository);
      const list = await useCase.execute(companyId, {
        salesOrderId: (req as any).query.salesOrderId ? String((req as any).query.salesOrderId) : undefined,
        status: toOptionalDNStatus((req as any).query.status),
        limit: toOptionalNumber((req as any).query.limit),
      });

      (res as any).json({
        success: true,
        data: list.map((dn) => SalesDTOMapper.toDeliveryNoteDTO(dn)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDN(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetDeliveryNoteUseCase(diContainer.deliveryNoteRepository);
      const dn = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toDeliveryNoteDTO(dn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateDN(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateDeliveryNoteInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdateDeliveryNoteUseCase(
        diContainer.deliveryNoteRepository,
        diContainer.partyRepository
      );

      const dn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toDeliveryNoteDTO(dn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postDN(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService();

      const useCase = new PostDeliveryNoteUseCase(
        diContainer.salesSettingsRepository,
        diContainer.inventorySettingsRepository,
        diContainer.deliveryNoteRepository,
        diContainer.salesOrderRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.warehouseRepository,
        diContainer.uomConversionRepository,
        diContainer.companyCurrencyRepository,
        inventoryService,
        diContainer.companyModuleRepository,
        accountingPostingService,
        diContainer.accountRepository,
        diContainer.transactionManager
      );

      const dn = await useCase.execute(companyId, id);
      (res as any).json({
        success: true,
        data: SalesDTOMapper.toDeliveryNoteDTO(dn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSI(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateSalesInvoiceInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const useCase = new CreateSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository
      );

      const si = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAndPostSI(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateSalesInvoiceInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const createUseCase = new CreateSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository
      );

      const postUseCase = SalesController.buildPostSalesInvoiceUseCase();

      const useCase = new CreateAndPostSalesInvoiceUseCase(
        createUseCase,
        postUseCase
      );

      const settlementInput = (req as any).body?.settlementInput;
      const si = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      }, settlementInput);

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateAndPostSI(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesInvoiceInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const userId = SalesController.getUserId(req);

      const updateUseCase = new UpdateSalesInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository
      );

      const postUseCase = SalesController.buildPostSalesInvoiceUseCase();

      const useCase = new UpdateAndPostSalesInvoiceUseCase(
        updateUseCase,
        postUseCase
      );

      const settlementInput = (req as any).body?.settlementInput;
      const si = await useCase.execute({
        ...((req as any).body || {}),
        id,
        companyId,
      }, settlementInput);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listSIs(req: Request, res: Response, next: NextFunction) {
    try {
      validateListSalesInvoicesQuery((req as any).query);
      const companyId = SalesController.getCompanyId(req);

      const useCase = new ListSalesInvoicesUseCase(diContainer.salesInvoiceRepository);
      const list = await useCase.execute(companyId, {
        customerId: (req as any).query.customerId ? String((req as any).query.customerId) : undefined,
        salesOrderId: (req as any).query.salesOrderId ? String((req as any).query.salesOrderId) : undefined,
        status: toOptionalSIStatus((req as any).query.status),
        paymentStatus: toOptionalPaymentStatus((req as any).query.paymentStatus),
        limit: toOptionalNumber((req as any).query.limit),
      });

      (res as any).json({
        success: true,
        data: list.map((si) => SalesDTOMapper.toSalesInvoiceDTO(si)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetSalesInvoiceUseCase(diContainer.salesInvoiceRepository);
      const si = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSI(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesInvoiceInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdateSalesInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository
      );

      const si = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postSI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService(true);

      const useCase = new PostSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.inventorySettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.deliveryNoteRepository,
        diContainer.partyRepository,
        diContainer.taxCodeRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.warehouseRepository,
        diContainer.uomConversionRepository,
        diContainer.companyCurrencyRepository,
        inventoryService,
        diContainer.companyModuleRepository,
        accountingPostingService,
        diContainer.accountRepository,
        diContainer.transactionManager,
        diContainer.paymentHistoryRepository,
        diContainer.voucherRepository,
        diContainer.voucherSequenceRepository,
        diContainer.ledgerRepository,
        diContainer.postingLogRepository
      );

      const settlementInput = (req as any).body?.settlementInput;
      const si = await useCase.execute(companyId, id, true, undefined, settlementInput);
      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createReturn(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateSalesReturnInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);

      const useCase = new CreateSalesReturnUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesReturnRepository,
        diContainer.salesInvoiceRepository,
        diContainer.deliveryNoteRepository
      );

      const salesReturn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toSalesReturnDTO(salesReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async listReturns(req: Request, res: Response, next: NextFunction) {
    try {
      validateListSalesReturnsQuery((req as any).query);
      const companyId = SalesController.getCompanyId(req);
      const useCase = new ListSalesReturnsUseCase(diContainer.salesReturnRepository);

      const list = await useCase.execute(companyId, {
        customerId: (req as any).query.customerId ? String((req as any).query.customerId) : undefined,
        salesInvoiceId: (req as any).query.salesInvoiceId ? String((req as any).query.salesInvoiceId) : undefined,
        deliveryNoteId: (req as any).query.deliveryNoteId ? String((req as any).query.deliveryNoteId) : undefined,
        status: toOptionalSRStatus((req as any).query.status),
      });

      (res as any).json({
        success: true,
        data: list.map((entry) => SalesDTOMapper.toSalesReturnDTO(entry)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetSalesReturnUseCase(diContainer.salesReturnRepository);
      const salesReturn = await useCase.execute(companyId, id);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesReturnDTO(salesReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateReturn(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesReturnInput((req as any).body);
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);

      const useCase = new UpdateSalesReturnUseCase(diContainer.salesReturnRepository);

      const salesReturn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesReturnDTO(salesReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async postReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService();

      const useCase = new PostSalesReturnUseCase(
        diContainer.salesSettingsRepository,
        diContainer.inventorySettingsRepository,
        diContainer.salesReturnRepository,
        diContainer.salesInvoiceRepository,
        diContainer.deliveryNoteRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.taxCodeRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.uomConversionRepository,
        diContainer.companyCurrencyRepository,
        inventoryService,
        diContainer.companyModuleRepository,
        accountingPostingService,
        diContainer.accountRepository,
        diContainer.transactionManager
      );

      const salesReturn = await useCase.execute(companyId, id);
      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesReturnDTO(salesReturn),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdateSalesInvoicePaymentStatusInput((req as any).body || {});
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const paidAmountBase = Number((req as any).body.paidAmountBase);

      const useCase = new UpdateSalesInvoicePaymentStatusUseCase(diContainer.salesInvoiceRepository);
      const invoice = await useCase.execute(companyId, id, paidAmountBase);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(invoice),
      });
    } catch (error) {
      next(error);
    }
  }

  static async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      validateRecordSalesInvoicePaymentInput((req as any).body || {});
      const companyId = SalesController.getCompanyId(req);
      const userId = SalesController.getUserId(req);
      const id = String((req as any).params.id);
      const body = (req as any).body || {};

      const useCase = new RecordSalesInvoicePaymentUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.paymentHistoryRepository,
        diContainer.salesSettingsRepository,
        diContainer.voucherRepository,
        diContainer.voucherSequenceRepository,
        diContainer.ledgerRepository,
        diContainer.companyCurrencyRepository,
        diContainer.transactionManager,
        diContainer.accountRepository
      );
      const result = await useCase.execute(companyId, userId, id, {
        settlementMode: body.settlementMode || 'CASH_FULL',
        receivablePayableAccountId: body.receivablePayableAccountId || body.arAccountId,
        settlements: [{
          settlementAccountId: body.settlementAccountId || body.cashAccountId,
          amountBase: Number(body.paymentAmountBase),
          paymentMethod: body.paymentMethod,
          reference: body.reference,
          notes: body.notes,
          paymentDate: body.paymentDate,
        }],
      });

      (res as any).json({
        success: true,
        data: {
          invoice: SalesDTOMapper.toSalesInvoiceDTO(result.invoice),
          payments: result.payments.map(p => p.toJSON()),
          voucherIds: result.voucherIds,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);

      const invoice = await diContainer.salesInvoiceRepository.getById(companyId, id);
      if (!invoice) {
        return (res as any).status(404).json({ success: false, error: 'Sales invoice not found' });
      }

      const payments = await diContainer.paymentHistoryRepository.getBySource(companyId, 'SALES_INVOICE', id);

      (res as any).json({
        success: true,
        data: payments.map((p) => p.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }
}
