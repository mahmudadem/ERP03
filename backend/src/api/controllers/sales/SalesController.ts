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
  ApproveSalesInvoiceUseCase,
  GetSalesInvoiceUseCase,
  GetInvoiceableLinkedSalesSourceUseCase,
  ListSalesInvoicesUseCase,
  PostSalesInvoiceUseCase,
  UpdateSalesInvoiceUseCase,
  UpdateAndPostSalesInvoiceUseCase,
} from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import {
  SendSalesInvoiceTelegramUseCase,
  SendSalesInvoiceWhatsappUseCase,
} from '../../../application/sales/use-cases/InvoiceMessagingUseCases';
import { AccrueCommissionForInvoiceUseCase } from '../../../application/sales/use-cases/CommissionUseCases';
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
import { CreditCheckService } from '../../../application/sales/services/CreditCheckService';
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
import { PeriodLockOverride } from '../../../domain/accounting/entities/PeriodLockOverride';
import { IAuditEngine } from '../../../application/system-core/contracts/IAuditEngine';
import { IAccountingBridge } from '../../../application/system-core/contracts/IAccountingBridge';
import { LegacyAccountingBridgeAdapter } from '../../../application/system-core/adapters/LegacyAccountingBridgeAdapter';
import { BackfillPartyAccountsUseCase } from '../../../application/shared/use-cases/BackfillPartyAccountsUseCase';
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
  validateSendSalesInvoiceTelegramInput,
  validateSendSalesInvoiceWhatsAppInput,
  validateUpdateSalesInvoiceInput,
  validateUpdateSalesReturnInput,
  validateUpdateDeliveryNoteInput,
  validateRecordSalesInvoicePaymentInput,
  validateUpdateSalesInvoicePaymentStatusInput,
  validateUpdateSalesOrderInput,
  validateUpdateSalesSettingsInput,
} from '../../validators/sales.validators';
import { ApiError } from '../../errors/ApiError';

/**
 * Governance gate for credit-limit overrides.
 * Allow only when (a) the company setting `allowCreditOverride` is on, AND
 * (b) the user is the company owner OR holds the `sales.creditOverride` permission.
 */
async function assertCanOverrideCreditLimit(
  companyId: string,
  user: Request['user']
): Promise<void> {
  const settings = await diContainer.salesSettingsRepository.getSettings(companyId);
  if (!settings || settings.allowCreditOverride === false) {
    throw ApiError.forbidden('Credit-limit overrides are disabled by company policy.');
  }
  const isOwner = !!user?.isOwner;
  const hasPerm = (user?.permissions ?? []).some(
    (p) => p === '*' || p === 'sales.creditOverride' || 'sales.creditOverride'.startsWith(p + '.')
  );
  if (!isOwner && !hasPerm) {
    throw ApiError.forbidden('You do not have permission to override credit limits.');
  }
}

/**
 * Governance gate for period-lock overrides.
 * Allow only when (a) accounting policy `allowPeriodLockOverride` is on, AND
 * (b) the user is the company owner OR holds the `accounting.periodLockOverride` permission.
 */
async function assertCanOverridePeriodLock(
  companyId: string,
  user: Request['user']
): Promise<void> {
  const cfg = await diContainer.accountingPolicyConfigProvider.getConfig(companyId);
  if (cfg.allowPeriodLockOverride === false) {
    throw ApiError.forbidden('Period-lock overrides are disabled by company policy.');
  }
  const isOwner = !!user?.isOwner;
  const hasPerm = (user?.permissions ?? []).some(
    (p) =>
      p === '*' ||
      p === 'accounting.periodLockOverride' ||
      'accounting.periodLockOverride'.startsWith(p + '.')
  );
  if (!isOwner && !hasPerm) {
    throw ApiError.forbidden('You do not have permission to override the period lock.');
  }
}

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

  private static getUserEmail(req: Request): string | undefined {
    return (req as any).user?.email;
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
        new VoucherValidationService(),
        diContainer.periodLockService,
        diContainer.policyRegistry as any
      );
    }

    return new SubledgerVoucherPostingService(
      diContainer.voucherRepository,
      diContainer.ledgerRepository,
      diContainer.companyCurrencyRepository,
      undefined,
      undefined,
      diContainer.periodLockService,
      diContainer.policyRegistry as any
    );
  }

  /**
   * FUP-3: wrap the same-config posting service in the accounting bridge so source-module GL
   * postings get the full-vs-minimal decision (no GL voucher when the Accounting App is disabled).
   * `validateAccounts` mirrors buildAccountingPostingService so full-mode behavior is unchanged.
   */
  private static buildAccountingBridge(validateAccounts: boolean = false): IAccountingBridge {
    return new LegacyAccountingBridgeAdapter(
      SalesController.buildAccountingPostingService(validateAccounts),
      diContainer.companyModuleRepository,
      diContainer.postingLogRepository
    );
  }

  private static buildPostSalesInvoiceUseCase(IAuditEngine?: IAuditEngine): PostSalesInvoiceUseCase {
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
      diContainer.postingLogRepository,
      IAuditEngine,
      diContainer.partyItemPriceRepository,
      diContainer.recordSalesProfitLineFactsUseCase,
      diContainer.numberingEngine,
      SalesController.buildAccountingBridge(true)
    );
  }

  private static async resolveLockedThroughDate(companyId: string): Promise<string | undefined> {
    try {
      const cfg = await diContainer.accountingPolicyConfigProvider.getConfig(companyId);
      return cfg.lockedThroughDate ?? undefined;
    } catch {
      return undefined;
    }
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
        diContainer.inventorySettingsRepository,
        diContainer.encryptionService,
        diContainer.ensureInventoryEngine
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
        diContainer.inventorySettingsRepository,
        diContainer.encryptionService
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

  static async backfillPartyAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const actorId = SalesController.getUserId(req);
      const useCase = new BackfillPartyAccountsUseCase(
        diContainer.partyRepository,
        diContainer.accountRepository,
        diContainer.salesSettingsRepository,
        diContainer.purchaseSettingsRepository,
        diContainer.companyRepository,
        diContainer.companyCurrencyRepository
      );

      const result = await useCase.execute({
        companyId,
        actorId,
        scope: 'AR',
        activeOnly: true,
      });

      (res as any).json({
        success: true,
        data: result,
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
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;
      const useCase = new CreateSalesOrderUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository,
        diContainer.promotionRuleRepository,
        IAuditEngine,
        diContainer.numberingEngine,
      );

      const so = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;

      const useCase = new UpdateSalesOrderUseCase(
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        IAuditEngine
      );

      const so = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);

      const useCase = new ConfirmSalesOrderUseCase(
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        new CreditCheckService(diContainer.salesInvoiceRepository),
        diContainer.creditOverrideRepository
      );

      // Optional override from request body: { override: { reason: string } }
      const rawOverride = (req as any).body?.override;
      const override = rawOverride?.reason
        ? { reason: String(rawOverride.reason), userId }
        : undefined;

      if (override) {
        await assertCanOverrideCreditLimit(companyId, (req as any).user);
      }

      const result = await useCase.execute(companyId, id, override ? { override } : undefined);

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toOrderDTO(result.salesOrder),
        creditCheck: result.creditCheck,
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
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;
      const useCase = new CreateDeliveryNoteUseCase(
        diContainer.salesSettingsRepository,
        diContainer.deliveryNoteRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        IAuditEngine,
        diContainer.numberingEngine
      );

      const dn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;

      const useCase = new UpdateDeliveryNoteUseCase(
        diContainer.deliveryNoteRepository,
        diContainer.partyRepository,
        IAuditEngine
      );

      const dn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService();

      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: userId }
        : undefined;

      const IAuditEngine = diContainer.auditEngine;
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
        diContainer.transactionManager,
        IAuditEngine,
        SalesController.buildAccountingBridge()
      );

      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;
      const dn = await useCase.execute(companyId, id, true, periodLockOverride, { userId, userEmail, lockedThroughDate });

      // Write period-lock override audit row (non-fatal)
      if (periodLockOverride) {
        try {
          // PeriodLockOverride imported at top level
          await diContainer.periodLockOverrideRepository.create(new PeriodLockOverride({
            companyId,
            sourceModule: 'sales',
            sourceType: 'DELIVERY_NOTE',
            sourceId: dn.id,
            sourceNumber: `DN-${dn.dnNumber}`,
            documentDate: dn.deliveryDate,
            lockedThroughDate: periodLockOverrideReason ? (await diContainer.accountingPolicyConfigProvider.getConfig(companyId)).lockedThroughDate ?? '' : '',
            reason: periodLockOverrideReason,
            overriddenBy: userId,
          }));
        } catch (auditErr) {
          console.error('[SalesController] period-lock override audit write failed (non-fatal):', auditErr);
        }
      }

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
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;
      const useCase = new CreateSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository,
        diContainer.promotionRuleRepository,
        new CreditCheckService(diContainer.salesInvoiceRepository),
        diContainer.creditOverrideRepository,
        IAuditEngine,
        diContainer.numberingEngine,
      );

      if ((req as any).body?.creditOverrideReason) {
        await assertCanOverrideCreditLimit(companyId, (req as any).user);
      }

      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
        creditOverrideReason: (req as any).body?.creditOverrideReason,
      }, undefined, { userId, userEmail });

      (res as any).status(201).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(result.salesInvoice),
        creditCheck: result.creditCheck,
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

      const userEmail = SalesController.getUserEmail(req);
      const IAuditEngine = diContainer.auditEngine;
      const createUseCase = new CreateSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository,
        diContainer.promotionRuleRepository,
        new CreditCheckService(diContainer.salesInvoiceRepository),
        diContainer.creditOverrideRepository,
        IAuditEngine,
        diContainer.numberingEngine,
      );

      const postUseCase = SalesController.buildPostSalesInvoiceUseCase(IAuditEngine);

      const useCase = new CreateAndPostSalesInvoiceUseCase(
        createUseCase,
        postUseCase
      );

      const settlementInput = (req as any).body?.settlementInput;
      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: SalesController.getUserId(req) }
        : undefined;
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;

      if ((req as any).body?.creditOverrideReason) {
        await assertCanOverrideCreditLimit(companyId, (req as any).user);
      }
      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }

      const si = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
        creditOverrideReason: (req as any).body?.creditOverrideReason,
      }, settlementInput, periodLockOverride, { userId, userEmail, lockedThroughDate });

      // Accrue sales commission (non-fatal — must not fail the post response)
      try {
        const accrueCommission = new AccrueCommissionForInvoiceUseCase(
          diContainer.salesInvoiceRepository,
          diContainer.salespersonRepository,
          diContainer.commissionEntryRepository,
        );
        await accrueCommission.execute({
          companyId,
          invoiceId: si.id,
          createdBy: userId,
        });
      } catch (commissionError) {
        console.error('[SalesController] commission accrual failed (non-fatal):', commissionError);
      }

      // Write period-lock override audit row (non-fatal)
      if (periodLockOverride) {
        try {
          await diContainer.periodLockOverrideRepository.create(new PeriodLockOverride({
            companyId,
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            sourceNumber: si.invoiceNumber ? `SI-${si.invoiceNumber}` : '',
            documentDate: si.invoiceDate,
            lockedThroughDate: periodLockOverrideReason ? (await diContainer.accountingPolicyConfigProvider.getConfig(companyId)).lockedThroughDate ?? '' : '',
            reason: periodLockOverrideReason,
            overriddenBy: userId,
          }));
        } catch (auditErr) {
          console.error('[SalesController] period-lock override audit write failed (non-fatal):', auditErr);
        }
      }

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

      const userEmail = SalesController.getUserEmail(req);
      const IAuditEngine = diContainer.auditEngine;
      const updateUseCase = new UpdateSalesInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository,
        IAuditEngine
      );

      const postUseCase = SalesController.buildPostSalesInvoiceUseCase(IAuditEngine);

      const useCase = new UpdateAndPostSalesInvoiceUseCase(
        updateUseCase,
        postUseCase
      );

      const settlementInput = (req as any).body?.settlementInput;
      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: SalesController.getUserId(req) }
        : undefined;
      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;
      const si = await useCase.execute({
        ...((req as any).body || {}),
        id,
        companyId,
      }, settlementInput, periodLockOverride, { userId, userEmail, lockedThroughDate });

      // Accrue sales commission (non-fatal — must not fail the post response)
      try {
        const accrueCommission = new AccrueCommissionForInvoiceUseCase(
          diContainer.salesInvoiceRepository,
          diContainer.salespersonRepository,
          diContainer.commissionEntryRepository,
        );
        await accrueCommission.execute({
          companyId,
          invoiceId: si.id,
          createdBy: userId,
        });
      } catch (commissionError) {
        console.error('[SalesController] commission accrual failed (non-fatal):', commissionError);
      }

      // Write period-lock override audit row (non-fatal)
      if (periodLockOverride) {
        try {
          await diContainer.periodLockOverrideRepository.create(new PeriodLockOverride({
            companyId,
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            sourceNumber: si.invoiceNumber ? `SI-${si.invoiceNumber}` : '',
            documentDate: si.invoiceDate,
            lockedThroughDate: periodLockOverrideReason ? (await diContainer.accountingPolicyConfigProvider.getConfig(companyId)).lockedThroughDate ?? '' : '',
            reason: periodLockOverrideReason,
            overriddenBy: userId,
          }));
        } catch (auditErr) {
          console.error('[SalesController] period-lock override audit write failed (non-fatal):', auditErr);
        }
      }

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;

      const useCase = new UpdateSalesInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository,
        IAuditEngine,
        diContainer.itemRepository
      );

      const si = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      }, undefined, { userId, userEmail });

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const existing = await diContainer.salesInvoiceRepository.getById(companyId, id);
      if (!existing) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Sales invoice not found.' } });
        return;
      }
      if (existing.status !== 'DRAFT') {
        (res as any).status(409).json({ success: false, error: { code: 'INVALID_STATE', message: 'Only DRAFT invoices can be discarded.' } });
        return;
      }
      await diContainer.salesInvoiceRepository.delete(companyId, id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async postSI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService(true);

      const IAuditEngine = diContainer.auditEngine;
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
        diContainer.postingLogRepository,
        IAuditEngine,
        diContainer.partyItemPriceRepository,
        diContainer.recordSalesProfitLineFactsUseCase,
        diContainer.numberingEngine,
        SalesController.buildAccountingBridge(true)
      );

      const settlementInput = (req as any).body?.settlementInput;
      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: userId }
        : undefined;
      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;
      const si = await useCase.execute(companyId, id, true, undefined, settlementInput, periodLockOverride, { userId, userEmail, lockedThroughDate });

      // Accrue sales commission (non-fatal — must not fail the post response)
      try {
        const accrueCommission = new AccrueCommissionForInvoiceUseCase(
          diContainer.salesInvoiceRepository,
          diContainer.salespersonRepository,
          diContainer.commissionEntryRepository,
        );
        await accrueCommission.execute({
          companyId,
          invoiceId: id,
          createdBy: userId,
        });
      } catch (commissionError) {
        console.error('[SalesController] commission accrual failed (non-fatal):', commissionError);
      }

      // Write period-lock override audit row (non-fatal)
      if (periodLockOverride) {
        try {
          // PeriodLockOverride imported at top level
          await diContainer.periodLockOverrideRepository.create(new PeriodLockOverride({
            companyId,
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: id,
            sourceNumber: si.invoiceNumber ? `SI-${si.invoiceNumber}` : '',
            documentDate: si.invoiceDate,
            lockedThroughDate: periodLockOverrideReason ? (await diContainer.accountingPolicyConfigProvider.getConfig(companyId)).lockedThroughDate ?? '' : '',
            reason: periodLockOverrideReason,
            overriddenBy: userId,
          }));
        } catch (auditErr) {
          console.error('[SalesController] period-lock override audit write failed (non-fatal):', auditErr);
        }
      }

      (res as any).json({
        success: true,
        data: SalesDTOMapper.toSalesInvoiceDTO(si),
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveSI(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesController.getCompanyId(req);
      const id = String((req as any).params.id);
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;
      const postUseCase = SalesController.buildPostSalesInvoiceUseCase(IAuditEngine);
      const approveUseCase = new ApproveSalesInvoiceUseCase(
        diContainer.salesInvoiceRepository,
        postUseCase
      );

      const settlementInput = (req as any).body?.settlementInput;
      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: userId }
        : undefined;
      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;

      const si = await approveUseCase.execute(
        companyId,
        id,
        { userId, userEmail, lockedThroughDate },
        settlementInput,
        periodLockOverride
      );

      // Approval is the real post — accrue commission just like postSI (non-fatal).
      try {
        const accrueCommission = new AccrueCommissionForInvoiceUseCase(
          diContainer.salesInvoiceRepository,
          diContainer.salespersonRepository,
          diContainer.commissionEntryRepository,
        );
        await accrueCommission.execute({ companyId, invoiceId: id, createdBy: userId });
      } catch (commissionError) {
        console.error('[SalesController] commission accrual failed (non-fatal):', commissionError);
      }

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
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;
      const useCase = new CreateSalesReturnUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesReturnRepository,
        diContainer.salesInvoiceRepository,
        diContainer.deliveryNoteRepository,
        IAuditEngine,
        diContainer.companyCurrencyRepository,
        diContainer.numberingEngine
      );

      const salesReturn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);

      const IAuditEngine = diContainer.auditEngine;

      const useCase = new UpdateSalesReturnUseCase(diContainer.salesReturnRepository, IAuditEngine);

      const salesReturn = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id,
      }, { userId, userEmail });

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
      const userId = SalesController.getUserId(req);
      const userEmail = SalesController.getUserEmail(req);
      const inventoryService = SalesController.buildSalesInventoryService();
      const accountingPostingService = SalesController.buildAccountingPostingService();

      const periodLockOverrideReason = (req as any).body?.periodLockOverrideReason;
      const periodLockOverride = periodLockOverrideReason
        ? { reason: periodLockOverrideReason, overriddenBy: userId }
        : undefined;

      const IAuditEngine = diContainer.auditEngine;
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
        diContainer.transactionManager,
        IAuditEngine,
        diContainer.postingLogRepository,
        diContainer.partyItemPriceRepository,
        diContainer.recordSalesProfitLineFactsUseCase,
        SalesController.buildAccountingBridge()
      );

      if (periodLockOverride) {
        await assertCanOverridePeriodLock(companyId, (req as any).user);
      }
      const lockedThroughDate = periodLockOverride ? await SalesController.resolveLockedThroughDate(companyId) : undefined;
      const salesReturn = await useCase.execute(companyId, id, true, periodLockOverride, { userId, userEmail, lockedThroughDate });

      // Write period-lock override audit row (non-fatal)
      if (periodLockOverride) {
        try {
          // PeriodLockOverride imported at top level
          await diContainer.periodLockOverrideRepository.create(new PeriodLockOverride({
            companyId,
            sourceModule: 'sales',
            sourceType: 'SALES_RETURN',
            sourceId: salesReturn.id,
            sourceNumber: `SR-${salesReturn.returnNumber}`,
            documentDate: salesReturn.returnDate,
            lockedThroughDate: periodLockOverrideReason ? (await diContainer.accountingPolicyConfigProvider.getConfig(companyId)).lockedThroughDate ?? '' : '',
            reason: periodLockOverrideReason,
            overriddenBy: userId,
          }));
        } catch (auditErr) {
          console.error('[SalesController] period-lock override audit write failed (non-fatal):', auditErr);
        }
      }

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
        diContainer.accountRepository,
        diContainer.partyRepository,
        diContainer.numberingEngine,
        SalesController.buildAccountingBridge()
      );
      const result = await useCase.execute(companyId, userId, id, {
        // Record-Payment is an inherently flexible receipt: MULTI handles partial
        // (→ PARTIALLY_PAID), full (→ PAID) and over-payment (→ party credit).
        // CASH_FULL would wrongly force the receipt to equal the full outstanding.
        settlementMode: body.settlementMode || 'MULTI',
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

  static async sendInvoiceViaWhatsApp(req: Request, res: Response, next: NextFunction) {
    try {
      validateSendSalesInvoiceWhatsAppInput((req as any).body || {});
      const companyId = SalesController.getCompanyId(req);
      const invoiceId = String((req as any).params.id);
      const body = (req as any).body || {};

      const useCase = new SendSalesInvoiceWhatsappUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository,
        diContainer.invoiceMessagingProvider,
        diContainer.companyMessagingResolver,
        process.env.ERP_APP_BASE_URL
      );

      const result = await useCase.execute({
        companyId,
        invoiceId,
        messagingAccountId: body.messagingAccountId,
        toPhoneNumber: body.toPhoneNumber,
        messageText: body.messageText,
        documentUrl: body.documentUrl,
      });

      (res as any).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async sendInvoiceViaTelegram(req: Request, res: Response, next: NextFunction) {
    try {
      validateSendSalesInvoiceTelegramInput((req as any).body || {});
      const companyId = SalesController.getCompanyId(req);
      const invoiceId = String((req as any).params.id);
      const body = (req as any).body || {};

      const useCase = new SendSalesInvoiceTelegramUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.partyRepository,
        diContainer.invoiceMessagingProvider,
        diContainer.companyMessagingResolver,
        process.env.ERP_APP_BASE_URL
      );

      const result = await useCase.execute({
        companyId,
        invoiceId,
        messagingAccountId: body.messagingAccountId,
        toChatId: body.toChatId,
        messageText: body.messageText,
        documentUrl: body.documentUrl,
      });

      (res as any).json({
        success: true,
        data: result,
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
