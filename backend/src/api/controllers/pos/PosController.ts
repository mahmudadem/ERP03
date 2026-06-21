/**
 * PosController.ts — Thin controller for the POS module.
 *
 * Pattern copied from SalesController:
 *   - Reads `req.user.companyId/uid/email`
 *   - Builds a use case from `diContainer` collaborators
 *   - Maps to DTOs and returns `{ success, data }`
 */
import { NextFunction, Request, Response } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PosDTOMapper, PosCashMovementDTO, PosXReportDTO, PosReceiptDTO, PosPaymentDTO, PosReturnDTO } from '../../dtos/PosDTOs';
import {
  CreatePosRegisterUseCase,
  GetPosRegisterUseCase,
  ListPosRegistersUseCase,
  UpdatePosRegisterUseCase,
} from '../../../application/pos/use-cases/PosRegisterUseCases';
import {
  GetPosSettingsUseCase,
  InitializePosUseCase,
  UpdatePosSettingsUseCase,
} from '../../../application/pos/use-cases/PosSettingsUseCases';
import {
  ClosePosShiftUseCase,
  CreatePosCashMovementUseCase,
  ForceClosePosShiftUseCase,
  GetPosShiftUseCase,
  GetPosXReportUseCase,
  ListPosShiftsUseCase,
  OpenPosShiftUseCase,
} from '../../../application/pos/use-cases/PosShiftUseCases';
import { CompletePosSaleUseCase } from '../../../application/pos/use-cases/CompletePosSaleUseCase';
import {
  GetPosBootstrapUseCase,
  SearchPosProductsUseCase,
} from '../../../application/pos/use-cases/PosBootstrapUseCase';
import { PreviewPosSaleUseCase } from '../../../application/pos/use-cases/PreviewPosSaleUseCase';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
import {
  CreateSalesInvoiceUseCase,
  PostSalesInvoiceUseCase,
} from '../../../application/sales/use-cases/SalesInvoiceUseCases';
import { RecordStockMovementUseCase } from '../../../application/inventory/use-cases/RecordStockMovementUseCase';
import { SalesInventoryService } from '../../../application/inventory/services/SalesInventoryService';
import {
  CreateSalesReturnUseCase,
  PostSalesReturnUseCase,
} from '../../../application/sales/use-cases/SalesReturnUseCases';
import { CompletePosReturnUseCase } from '../../../application/pos/use-cases/CompletePosReturnUseCase';
import {
  GetCashierSalesSummaryUseCase,
  GetCashOverShortReportUseCase,
  GetDailyPosSummaryUseCase,
  GetPaymentMethodSummaryUseCase,
  GetPosZReportUseCase,
  GetReceiptHistoryUseCase,
} from '../../../application/pos/use-cases/PosReportingUseCases';
import { CreditCheckService } from '../../../application/sales/services/CreditCheckService';
import { RecordChangeService } from '../../../application/system/services/RecordChangeService';
import {
  validateUpdatePosSettingsInput,
  validateUpsertPosRegisterInput,
} from '../../validators/pos.validators';

export class PosController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) throw new Error('Company context not found');
    return companyId;
  }

  private static getUserEmail(req: Request): string | undefined {
    return (req as any).user?.email;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  // ===== Settings =====

  static async initializePos(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new InitializePosUseCase(diContainer.posSettingsRepository);
      const settings = await useCase.execute(companyId);
      (res as any).json({ success: true, data: PosDTOMapper.toSettingsDTO(settings) });
    } catch (error) {
      next(error);
    }
  }

  static async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetPosSettingsUseCase(diContainer.posSettingsRepository);
      const settings = await useCase.execute(companyId);
      (res as any).json({
        success: true,
        data: settings ? PosDTOMapper.toSettingsDTO(settings) : null,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpdatePosSettingsInput((req as any).body);
      const companyId = PosController.getCompanyId(req);
      const useCase = new UpdatePosSettingsUseCase(
        diContainer.posSettingsRepository,
        diContainer.accountRepository,
        diContainer.posPolicyRepository
      );
      const settings = await useCase.execute({ ...(req as any).body, companyId });
      (res as any).json({ success: true, data: PosDTOMapper.toSettingsDTO(settings) });
    } catch (error) {
      next(error);
    }
  }

  // ===== Registers =====

  static async listRegisters(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new ListPosRegistersUseCase(diContainer.posRegisterRepository);
      const list = await useCase.execute(companyId);
      (res as any).json({
        success: true,
        data: list.map((r) => PosDTOMapper.toRegisterDTO(r)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPosRegisterUseCase(diContainer.posRegisterRepository);
      const register = await useCase.execute(companyId, id);
      if (!register) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Register not found' } });
        return;
      }
      (res as any).json({ success: true, data: PosDTOMapper.toRegisterDTO(register) });
    } catch (error) {
      next(error);
    }
  }

  static async createRegister(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpsertPosRegisterInput((req as any).body);
      const companyId = PosController.getCompanyId(req);
      const useCase = new CreatePosRegisterUseCase(diContainer.posRegisterRepository);
      const register = await useCase.execute({ ...(req as any).body, companyId });
      (res as any).status(201).json({ success: true, data: PosDTOMapper.toRegisterDTO(register) });
    } catch (error) {
      next(error);
    }
  }

  static async updateRegister(req: Request, res: Response, next: NextFunction) {
    try {
      validateUpsertPosRegisterInput((req as any).body);
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new UpdatePosRegisterUseCase(diContainer.posRegisterRepository);
      const register = await useCase.execute(companyId, id, (req as any).body || {});
      (res as any).json({ success: true, data: PosDTOMapper.toRegisterDTO(register) });
    } catch (error) {
      next(error);
    }
  }

  // ===== Shifts =====

  private static buildAccountingPostingService(): SubledgerVoucherPostingService {
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

  static async openShift(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const useCase = new OpenPosShiftUseCase(
        diContainer.posShiftRepository,
        diContainer.posRegisterRepository,
        diContainer.posSettingsRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager
      );
      const shift = await useCase.execute({
        companyId,
        registerId: String((req as any).body?.registerId),
        cashierUserId: String((req as any).body?.cashierUserId || userId),
        openingFloat: Number((req as any).body?.openingFloat) || 0,
        actor: { userId },
      });
      (res as any).status(201).json({ success: true, data: PosDTOMapper.toShiftDTO(shift) });
    } catch (error) {
      next(error);
    }
  }

  static async closeShift(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const id = String((req as any).params.id);
      const useCase = new ClosePosShiftUseCase(
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posRegisterRepository,
        diContainer.posCashMovementRepository,
        diContainer.accountRepository,
        PosController.buildAccountingPostingService(),
        diContainer.transactionManager
      );
      const result = await useCase.execute({
        companyId,
        shiftId: id,
        countedCash: Number((req as any).body?.countedCash) || 0,
        actor: { userId },
      });
      (res as any).json({
        success: true,
        data: {
          shift: PosDTOMapper.toShiftDTO(result.shift),
          totals: result.totals,
          overShortAmount: result.overShortAmount,
          overShortVoucherId: result.overShortVoucherId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async forceCloseShift(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const id = String((req as any).params.id);
      const useCase = new ForceClosePosShiftUseCase(
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posRegisterRepository,
        diContainer.posCashMovementRepository,
        diContainer.accountRepository,
        PosController.buildAccountingPostingService(),
        diContainer.transactionManager
      );
      const result = await useCase.execute({
        companyId,
        shiftId: id,
        countedCash: Number((req as any).body?.countedCash) || 0,
        actor: { userId },
      });
      (res as any).json({
        success: true,
        data: {
          shift: PosDTOMapper.toShiftDTO(result.shift),
          totals: result.totals,
          overShortAmount: result.overShortAmount,
          overShortVoucherId: result.overShortVoucherId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createCashMovement(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const id = String((req as any).params.id);
      const useCase = new CreatePosCashMovementUseCase(
        diContainer.posShiftRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager
      );
      const movement = await useCase.execute({
        companyId,
        shiftId: id,
        type: String((req as any).body?.type) as any,
        amount: Number((req as any).body?.amount) || 0,
        reason: (req as any).body?.reason as string | undefined,
        actor: { userId },
      });
      (res as any).status(201).json({ success: true, data: PosCashMovementDTO.fromDomain(movement) });
    } catch (error) {
      next(error);
    }
  }

  static async listShifts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new ListPosShiftsUseCase(diContainer.posShiftRepository);
      const list = await useCase.execute(companyId, {
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        status: (req as any).query?.status ? String((req as any).query.status) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data: list.map((s) => PosDTOMapper.toShiftDTO(s)) });
    } catch (error) {
      next(error);
    }
  }

  static async getShift(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPosShiftUseCase(diContainer.posShiftRepository);
      const shift = await useCase.execute(companyId, id);
      if (!shift) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Shift not found' } });
        return;
      }
      (res as any).json({ success: true, data: PosDTOMapper.toShiftDTO(shift) });
    } catch (error) {
      next(error);
    }
  }

  static async getXReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPosXReportUseCase(
        diContainer.posShiftRepository,
        diContainer.posCashMovementRepository
      );
      const report = await useCase.execute({ companyId, shiftId: id });
      (res as any).json({ success: true, data: PosXReportDTO.fromDomain(report) });
    } catch (error) {
      next(error);
    }
  }

  // ===== Sale / Receipts =====

  private static buildSalesInventoryService(): SalesInventoryService {
    const movementUseCase = new RecordStockMovementUseCase({
      itemRepository: diContainer.itemRepository,
      warehouseRepository: diContainer.warehouseRepository,
      stockMovementRepository: diContainer.stockMovementRepository,
      stockLevelRepository: diContainer.stockLevelRepository,
      companyRepository: diContainer.companyRepository,
      inventorySettingsRepository: diContainer.inventorySettingsRepository,
      transactionManager: diContainer.transactionManager,
    });
    return new SalesInventoryService(movementUseCase);
  }

  private static buildCreateSalesInvoiceUseCase(recordChangeService?: RecordChangeService): CreateSalesInvoiceUseCase {
    return new CreateSalesInvoiceUseCase(
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
      recordChangeService,
    );
  }

  private static buildPostSalesInvoiceUseCase(recordChangeService?: RecordChangeService): PostSalesInvoiceUseCase {
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
      // Real inventory service — required so stock-item POS sales create the inventory OUT movement.
      PosController.buildSalesInventoryService(),
      diContainer.companyModuleRepository,
      PosController.buildAccountingPostingService(),
      diContainer.accountRepository,
      diContainer.transactionManager,
      diContainer.paymentHistoryRepository,
      diContainer.voucherRepository,
      diContainer.voucherSequenceRepository,
      diContainer.ledgerRepository,
      diContainer.postingLogRepository,
      recordChangeService,
      diContainer.partyItemPriceRepository,
      diContainer.recordSalesProfitLineFactsUseCase
    );
  }

  static async getBootstrap(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetPosBootstrapUseCase(
        diContainer.posRegisterRepository,
        diContainer.posSettingsRepository,
        diContainer.posShiftRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.partyRepository
      );
      const result = await useCase.execute({
        companyId,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        cashierUserId: (req as any).query?.cashierUserId ? String((req as any).query.cashierUserId) : undefined,
      });
      (res as any).json({
        success: true,
        data: {
          register: result.register ? PosDTOMapper.toRegisterDTO(result.register) : null,
          openShift: result.openShift ? PosDTOMapper.toShiftDTO(result.openShift) : null,
          settings: PosDTOMapper.toSettingsDTO(result.settings),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async searchProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const query = String((req as any).query?.q || '');
      const limit = (req as any).query?.limit ? Number((req as any).query.limit) : 25;
      const useCase = new SearchPosProductsUseCase(diContainer.itemRepository);
      const result = await useCase.execute({ companyId, query, limit });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async previewSale(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new PreviewPosSaleUseCase(diContainer.itemRepository, diContainer.taxCodeRepository);
      const result = await useCase.execute({
        companyId,
        lines: (req as any).body?.lines || [],
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async completeSale(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const recordChangeService = new RecordChangeService(diContainer.recordChangeLogRepository);
      const useCase = new CompletePosSaleUseCase(
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posRegisterRepository,
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager,
        PosController.buildCreateSalesInvoiceUseCase(recordChangeService),
        PosController.buildPostSalesInvoiceUseCase(recordChangeService),
        diContainer.salesInvoiceRepository,
        diContainer.policyEngine
      );
      const result = await useCase.execute({
        companyId,
        registerId: String((req as any).body?.registerId),
        shiftId: String((req as any).body?.shiftId),
        customerId: (req as any).body?.customerId ? String((req as any).body.customerId) : undefined,
        lines: (req as any).body?.lines || [],
        payments: (req as any).body?.payments || [],
        actor: { userId, userEmail },
      });
      (res as any).status(201).json({
        success: true,
        data: {
          receipt: PosReceiptDTO.fromDomain(result.receipt),
          salesInvoiceId: result.salesInvoiceId,
          salesInvoiceNumber: result.salesInvoiceNumber,
          change: result.change,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const list = await diContainer.posReceiptRepository.list(companyId, {
        shiftId: (req as any).query?.shiftId ? String((req as any).query.shiftId) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        customerId: (req as any).query?.customerId ? String((req as any).query.customerId) : undefined,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({
        success: true,
        data: list.map((r) => PosReceiptDTO.fromDomain(r)),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const receipt = await diContainer.posReceiptRepository.getById(companyId, id);
      if (!receipt) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receipt not found' } });
        return;
      }
      const payments = await diContainer.posPaymentRepository.listByReceipt(companyId, id);
      (res as any).json({
        success: true,
        data: {
          receipt: PosReceiptDTO.fromDomain(receipt),
          payments: payments.map((p) => PosPaymentDTO.fromDomain(p)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async reprintReceipt(req: Request, res: Response, next: NextFunction) {
    // Reprint = same as getReceipt (read-only, no state change).
    return PosController.getReceipt(req, res, next);
  }

  // ===== Returns =====

  private static buildCreateSalesReturnUseCase(recordChangeService?: RecordChangeService): CreateSalesReturnUseCase {
    return new CreateSalesReturnUseCase(
      diContainer.salesSettingsRepository,
      diContainer.salesReturnRepository,
      diContainer.salesInvoiceRepository,
      diContainer.deliveryNoteRepository,
      recordChangeService,
      diContainer.companyCurrencyRepository
    );
  }

  private static buildPostSalesReturnUseCase(recordChangeService?: RecordChangeService): PostSalesReturnUseCase {
    return new PostSalesReturnUseCase(
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
      null as any,
      diContainer.companyModuleRepository,
      PosController.buildAccountingPostingService(),
      diContainer.accountRepository,
      diContainer.transactionManager,
      recordChangeService,
      diContainer.postingLogRepository,
      diContainer.partyItemPriceRepository,
      diContainer.recordSalesProfitLineFactsUseCase
    );
  }

  static async completeReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const recordChangeService = new RecordChangeService(diContainer.recordChangeLogRepository);
      const useCase = new CompletePosReturnUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository,
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager,
        PosController.buildCreateSalesReturnUseCase(recordChangeService),
        PosController.buildPostSalesReturnUseCase(recordChangeService)
      );
      const result = await useCase.execute({
        companyId,
        originalReceiptId: String((req as any).body?.originalReceiptId),
        registerId: String((req as any).body?.registerId),
        shiftId: (req as any).body?.shiftId ? String((req as any).body.shiftId) : undefined,
        lines: (req as any).body?.lines || [],
        refundMethod: String((req as any).body?.refundMethod) as any,
        actor: { userId, userEmail },
      });
      (res as any).status(201).json({
        success: true,
        data: {
          posReturn: PosReturnDTO.fromDomain(result.posReturn),
          salesReturnId: result.salesReturn.id,
          salesReturnNumber: result.salesReturn.returnNumber,
          refundTotal: result.refundTotal,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listReturns(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const list = await diContainer.posReturnRepository.list(companyId, {
        shiftId: (req as any).query?.shiftId ? String((req as any).query.shiftId) : undefined,
        originalReceiptId: (req as any).query?.originalReceiptId ? String((req as any).query.originalReceiptId) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data: list.map((r) => PosReturnDTO.fromDomain(r)) });
    } catch (error) {
      next(error);
    }
  }

  static async getReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const ret = await diContainer.posReturnRepository.getById(companyId, id);
      if (!ret) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Return not found' } });
        return;
      }
      (res as any).json({ success: true, data: PosReturnDTO.fromDomain(ret) });
    } catch (error) {
      next(error);
    }
  }

  // ===== Reports =====

  static async getZReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPosZReportUseCase(
        diContainer.posShiftRepository,
        diContainer.posCashMovementRepository,
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository
      );
      const data = await useCase.execute({ companyId, shiftId: id });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getDailySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetDailyPosSummaryUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository
      );
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPaymentMethodSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetPaymentMethodSummaryUseCase(diContainer.posReceiptRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getCashierSales(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetCashierSalesSummaryUseCase(
        diContainer.posShiftRepository,
        diContainer.posReceiptRepository
      );
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getCashOverShort(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetCashOverShortReportUseCase(diContainer.posShiftRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getReceiptHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetReceiptHistoryUseCase(diContainer.posReceiptRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        customerId: (req as any).query?.customerId ? String((req as any).query.customerId) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
