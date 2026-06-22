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
import { PosDTOMapper, PosCashMovementDTO, PosXReportDTO, PosReceiptDTO, PosPaymentDTO, PosReturnDTO, PosHeldCartDTO } from '../../dtos/PosDTOs';
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
import { PostPosSaleUseCase } from '../../../application/pos/use-cases/PostPosSaleUseCase';
import {
  GetPosBootstrapUseCase,
  SearchPosProductsUseCase,
} from '../../../application/pos/use-cases/PosBootstrapUseCase';
import { PreviewPosSaleUseCase } from '../../../application/pos/use-cases/PreviewPosSaleUseCase';
import { CompletePosReturnUseCase, VoidPosReceiptUseCase } from '../../../application/pos/use-cases/CompletePosReturnUseCase';
import { CompletePosExchangeUseCase } from '../../../application/pos/use-cases/CompletePosExchangeUseCase';
import { ReprintPosReceiptUseCase } from '../../../application/pos/use-cases/PosReceiptUseCases';
import { CreatePosManagerOverrideUseCase } from '../../../application/pos/use-cases/PosManagerOverrideUseCases';
import {
  CancelPosHeldCartUseCase,
  GetPosHeldCartUseCase,
  HoldPosCartUseCase,
  ListPosHeldCartsUseCase,
  RecallPosHeldCartUseCase,
} from '../../../application/pos/use-cases/PosHeldCartUseCases';
import { PostPosReturnUseCase } from '../../../application/pos/use-cases/PostPosReturnUseCase';
import {
  GetCashierSalesSummaryUseCase,
  GetCashOverShortReportUseCase,
  GetCancelledReceiptsUseCase,
  GetDailyPosSummaryUseCase,
  GetPaymentMethodSummaryUseCase,
  GetPosOverrideAuditReportUseCase,
  GetPosReprintAuditReportUseCase,
  GetPosZReportUseCase,
  GetReceiptHistoryUseCase,
  GetTopSellingItemsUseCase,
} from '../../../application/pos/use-cases/PosReportingUseCases';
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
        diContainer.posPolicyRepository,
        diContainer.auditEngine
      );
      const settings = await useCase.execute({
        ...(req as any).body,
        companyId,
        actor: { userId: PosController.getUserId(req), userEmail: PosController.getUserEmail(req) },
      });
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
      const useCase = new CreatePosRegisterUseCase(diContainer.posRegisterRepository, diContainer.auditEngine);
      const register = await useCase.execute({
        ...(req as any).body,
        companyId,
        actor: { userId: PosController.getUserId(req), userEmail: PosController.getUserEmail(req) },
      });
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
      const useCase = new UpdatePosRegisterUseCase(diContainer.posRegisterRepository, diContainer.auditEngine);
      const register = await useCase.execute(companyId, id, {
        ...((req as any).body || {}),
        actor: { userId: PosController.getUserId(req), userEmail: PosController.getUserEmail(req) },
      });
      (res as any).json({ success: true, data: PosDTOMapper.toRegisterDTO(register) });
    } catch (error) {
      next(error);
    }
  }

  // ===== Shifts =====

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
        diContainer.accountingBridge,
        diContainer.transactionManager,
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository
      );
      const result = await useCase.execute({
        companyId,
        shiftId: id,
        countedCash: Number((req as any).body?.countedCash) || 0,
        countedPaymentTotals: (req as any).body?.countedPaymentTotals,
        actor: { userId },
      });
      (res as any).json({
        success: true,
        data: {
          shift: PosDTOMapper.toShiftDTO(result.shift),
          totals: result.totals,
          overShortAmount: result.overShortAmount,
          overShortVoucherId: result.overShortVoucherId,
          expectedPaymentTotals: result.expectedPaymentTotals,
          countedPaymentTotals: result.countedPaymentTotals,
          overShortPaymentTotals: result.overShortPaymentTotals,
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
        diContainer.accountingBridge,
        diContainer.transactionManager,
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository
      );
      const result = await useCase.execute({
        companyId,
        shiftId: id,
        countedCash: Number((req as any).body?.countedCash) || 0,
        countedPaymentTotals: (req as any).body?.countedPaymentTotals,
        actor: { userId },
      });
      (res as any).json({
        success: true,
        data: {
          shift: PosDTOMapper.toShiftDTO(result.shift),
          totals: result.totals,
          overShortAmount: result.overShortAmount,
          overShortVoucherId: result.overShortVoucherId,
          expectedPaymentTotals: result.expectedPaymentTotals,
          countedPaymentTotals: result.countedPaymentTotals,
          overShortPaymentTotals: result.overShortPaymentTotals,
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
      const useCase = new SearchPosProductsUseCase(diContainer.itemRepository, diContainer.commercialCore);
      const result = await useCase.execute({ companyId, query, limit });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async previewSale(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new PreviewPosSaleUseCase(diContainer.itemRepository, diContainer.taxCodeRepository, diContainer.taxEngine);
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
      const useCase = new CompletePosSaleUseCase(
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posRegisterRepository,
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager,
        new PostPosSaleUseCase(
          diContainer.itemRepository,
          diContainer.itemCategoryRepository,
          diContainer.inventorySettingsRepository,
          diContainer.partyRepository,
          diContainer.taxCodeRepository,
          diContainer.companyCurrencyRepository,
          diContainer.inventoryCore,
          diContainer.accountingBridge,
          diContainer.taxEngine,
          diContainer.commercialCore,
          diContainer.promotionRuleRepository
        ),
        diContainer.policyEngine,
        diContainer.numberingEngine,
        diContainer.auditEngine
      );
      const result = await useCase.execute({
        companyId,
        registerId: String((req as any).body?.registerId),
        shiftId: String((req as any).body?.shiftId),
        customerId: (req as any).body?.customerId ? String((req as any).body.customerId) : undefined,
        lines: (req as any).body?.lines || [],
        payments: (req as any).body?.payments || [],
        actor: { userId, userEmail, roleId: (req as any).body?.cashierRoleId ? String((req as any).body.cashierRoleId) : undefined },
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
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new ReprintPosReceiptUseCase(
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository,
        diContainer.policyEngine,
        diContainer.auditEngine
      );
      const result = await useCase.execute({
        companyId,
        receiptId: id,
        managerOverrideId: (req as any).query?.managerOverrideId ? String((req as any).query.managerOverrideId) : undefined,
        reason: (req as any).query?.reason ? String((req as any).query.reason) : undefined,
        actor: {
          userId: PosController.getUserId(req),
          userEmail: PosController.getUserEmail(req),
          roleId: (req as any).user?.roleId,
        },
      });
      (res as any).json({
        success: true,
        data: {
          receipt: PosReceiptDTO.fromDomain(result.receipt),
          payments: result.payments.map((p: any) => PosPaymentDTO.fromDomain(p)),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createManagerOverride(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const useCase = new CreatePosManagerOverrideUseCase(diContainer.auditEngine);
      const result = await useCase.execute({
        companyId,
        action: String((req as any).body?.action) as any,
        managerUserId: String((req as any).body?.managerUserId || ''),
        managerName: (req as any).body?.managerName ? String((req as any).body.managerName) : undefined,
        reason: String((req as any).body?.reason || ''),
        context: ((req as any).body?.context || {}) as Record<string, unknown>,
        actor: { userId, userEmail },
      });
      (res as any).status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async holdCart(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const useCase = new HoldPosCartUseCase(
        diContainer.posHeldCartRepository,
        diContainer.posShiftRepository,
        diContainer.posRegisterRepository,
        diContainer.auditEngine
      );
      const cart = await useCase.execute({
        companyId,
        registerId: String((req as any).body?.registerId),
        shiftId: String((req as any).body?.shiftId),
        cashierUserId: String((req as any).body?.cashierUserId || userId),
        customerId: (req as any).body?.customerId ? String((req as any).body.customerId) : undefined,
        note: (req as any).body?.note ? String((req as any).body.note) : undefined,
        lines: (req as any).body?.lines || [],
        subtotal: (req as any).body?.subtotal !== undefined ? Number((req as any).body.subtotal) : undefined,
        discountTotal: (req as any).body?.discountTotal !== undefined ? Number((req as any).body.discountTotal) : undefined,
        taxTotal: (req as any).body?.taxTotal !== undefined ? Number((req as any).body.taxTotal) : undefined,
        grandTotal: (req as any).body?.grandTotal !== undefined ? Number((req as any).body.grandTotal) : undefined,
        actor: { userId, userEmail },
      });
      (res as any).status(201).json({ success: true, data: PosHeldCartDTO.fromDomain(cart) });
    } catch (error) {
      next(error);
    }
  }

  static async listHeldCarts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new ListPosHeldCartsUseCase(diContainer.posHeldCartRepository);
      const list = await useCase.execute({
        companyId,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        shiftId: (req as any).query?.shiftId ? String((req as any).query.shiftId) : undefined,
        cashierUserId: (req as any).query?.cashierUserId ? String((req as any).query.cashierUserId) : undefined,
        status: (req as any).query?.status ? String((req as any).query.status) as any : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data: list.map((cart) => PosHeldCartDTO.fromDomain(cart)) });
    } catch (error) {
      next(error);
    }
  }

  static async getHeldCart(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const id = String((req as any).params.id);
      const useCase = new GetPosHeldCartUseCase(diContainer.posHeldCartRepository);
      const cart = await useCase.execute(companyId, id);
      if (!cart) {
        (res as any).status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Held cart not found' } });
        return;
      }
      (res as any).json({ success: true, data: PosHeldCartDTO.fromDomain(cart) });
    } catch (error) {
      next(error);
    }
  }

  static async recallHeldCart(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const useCase = new RecallPosHeldCartUseCase(diContainer.posHeldCartRepository, diContainer.auditEngine);
      const cart = await useCase.execute({
        companyId,
        id: String((req as any).params.id),
        actor: { userId, userEmail },
      });
      (res as any).json({ success: true, data: PosHeldCartDTO.fromDomain(cart) });
    } catch (error) {
      next(error);
    }
  }

  static async cancelHeldCart(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const useCase = new CancelPosHeldCartUseCase(diContainer.posHeldCartRepository, diContainer.auditEngine);
      const cart = await useCase.execute({
        companyId,
        id: String((req as any).params.id),
        reason: (req as any).body?.reason ? String((req as any).body.reason) : undefined,
        actor: { userId, userEmail },
      });
      (res as any).json({ success: true, data: PosHeldCartDTO.fromDomain(cart) });
    } catch (error) {
      next(error);
    }
  }

  static async voidReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const completeReturnUseCase = new CompletePosReturnUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository,
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posCashMovementRepository,
        diContainer.posRegisterRepository,
        diContainer.transactionManager,
        new PostPosReturnUseCase(
          diContainer.itemRepository,
          diContainer.itemCategoryRepository,
          diContainer.inventorySettingsRepository,
          diContainer.partyRepository,
          diContainer.companyCurrencyRepository,
          diContainer.inventoryCore,
          diContainer.accountingBridge
        ),
        diContainer.policyEngine,
        diContainer.auditEngine
      );
      const useCase = new VoidPosReceiptUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository,
        completeReturnUseCase
      );
      const result = await useCase.execute({
        companyId,
        receiptId: String((req as any).params.id),
        registerId: String((req as any).body?.registerId),
        shiftId: (req as any).body?.shiftId ? String((req as any).body.shiftId) : undefined,
        refundMethod: String((req as any).body?.refundMethod) as any,
        reason: (req as any).body?.reason ? String((req as any).body.reason) : undefined,
        managerOverrideId: (req as any).body?.managerOverrideId ? String((req as any).body.managerOverrideId) : undefined,
        actor: { userId, userEmail, roleId: (req as any).body?.cashierRoleId ? String((req as any).body.cashierRoleId) : undefined },
      });
      (res as any).status(201).json({
        success: true,
        data: {
          posReturn: PosReturnDTO.fromDomain(result.posReturn),
          salesReturnId: result.salesReturn.id,
          salesReturnNumber: result.salesReturn.returnNumber,
          refundTotal: result.refundTotal,
          receiptStatus: 'VOIDED',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ===== Returns =====

  static async completeExchange(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const postReturnUseCase = new PostPosReturnUseCase(
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.inventorySettingsRepository,
        diContainer.partyRepository,
        diContainer.companyCurrencyRepository,
        diContainer.inventoryCore,
        diContainer.accountingBridge
      );
      const completeReturnUseCase = new CompletePosReturnUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository,
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posCashMovementRepository,
        diContainer.posRegisterRepository,
        diContainer.transactionManager,
        postReturnUseCase,
        diContainer.policyEngine,
        diContainer.auditEngine
      );
      const completeSaleUseCase = new CompletePosSaleUseCase(
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posRegisterRepository,
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository,
        diContainer.posCashMovementRepository,
        diContainer.transactionManager,
        new PostPosSaleUseCase(
          diContainer.itemRepository,
          diContainer.itemCategoryRepository,
          diContainer.inventorySettingsRepository,
          diContainer.partyRepository,
          diContainer.taxCodeRepository,
          diContainer.companyCurrencyRepository,
          diContainer.inventoryCore,
          diContainer.accountingBridge,
          diContainer.taxEngine,
          diContainer.commercialCore,
          diContainer.promotionRuleRepository
        ),
        diContainer.policyEngine,
        diContainer.numberingEngine,
        diContainer.auditEngine
      );
      const useCase = new CompletePosExchangeUseCase(
        diContainer.posReceiptRepository,
        completeReturnUseCase,
        completeSaleUseCase
      );
      const result = await useCase.execute({
        companyId,
        originalReceiptId: String((req as any).body?.originalReceiptId),
        registerId: String((req as any).body?.registerId),
        shiftId: String((req as any).body?.shiftId),
        customerId: (req as any).body?.customerId ? String((req as any).body.customerId) : undefined,
        returnLines: (req as any).body?.returnLines || [],
        saleLines: (req as any).body?.saleLines || [],
        salePayments: (req as any).body?.salePayments || [],
        refundMethod: String((req as any).body?.refundMethod) as any,
        reason: (req as any).body?.reason ? String((req as any).body.reason) : undefined,
        managerOverrideId: (req as any).body?.managerOverrideId ? String((req as any).body.managerOverrideId) : undefined,
        actor: { userId, userEmail, roleId: (req as any).body?.cashierRoleId ? String((req as any).body.cashierRoleId) : undefined },
      });
      (res as any).status(201).json({
        success: true,
        data: {
          exchangeId: result.exchangeId,
          posReturn: PosReturnDTO.fromDomain(result.posReturn),
          receipt: PosReceiptDTO.fromDomain(result.saleReceipt),
          salesReturnId: result.salesReturnId,
          salesReturnNumber: result.salesReturnNumber,
          salesInvoiceId: result.salesInvoiceId,
          salesInvoiceNumber: result.salesInvoiceNumber,
          refundTotal: result.refundTotal,
          saleTotal: result.saleTotal,
          netDueFromCustomer: result.netDueFromCustomer,
          netRefundToCustomer: result.netRefundToCustomer,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async completeReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const userId = PosController.getUserId(req);
      const userEmail = PosController.getUserEmail(req);
      const useCase = new CompletePosReturnUseCase(
        diContainer.posReceiptRepository,
        diContainer.posReturnRepository,
        diContainer.posShiftRepository,
        diContainer.posSettingsRepository,
        diContainer.posCashMovementRepository,
        diContainer.posRegisterRepository,
        diContainer.transactionManager,
        new PostPosReturnUseCase(
          diContainer.itemRepository,
          diContainer.itemCategoryRepository,
          diContainer.inventorySettingsRepository,
          diContainer.partyRepository,
          diContainer.companyCurrencyRepository,
          diContainer.inventoryCore,
          diContainer.accountingBridge
        ),
        diContainer.policyEngine,
        diContainer.auditEngine
      );
      const result = await useCase.execute({
        companyId,
        originalReceiptId: String((req as any).body?.originalReceiptId),
        registerId: String((req as any).body?.registerId),
        shiftId: (req as any).body?.shiftId ? String((req as any).body.shiftId) : undefined,
        lines: (req as any).body?.lines || [],
        refundMethod: String((req as any).body?.refundMethod) as any,
        managerOverrideId: (req as any).body?.managerOverrideId ? String((req as any).body.managerOverrideId) : undefined,
        actor: { userId, userEmail, roleId: (req as any).body?.cashierRoleId ? String((req as any).body.cashierRoleId) : undefined },
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
      const useCase = new GetPaymentMethodSummaryUseCase(
        diContainer.posReceiptRepository,
        diContainer.posPaymentRepository
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

  static async getCancelledReceipts(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetCancelledReceiptsUseCase(diContainer.posReceiptRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getTopSellingItems(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetTopSellingItemsUseCase(diContainer.posReceiptRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getOverrideAuditReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetPosOverrideAuditReportUseCase(diContainer.posReceiptRepository);
      const data = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        registerId: (req as any).query?.registerId ? String((req as any).query.registerId) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getReprintAuditReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PosController.getCompanyId(req);
      const useCase = new GetPosReprintAuditReportUseCase(diContainer.recordChangeLogRepository);
      const rows = await useCase.execute({
        companyId,
        dateFrom: (req as any).query?.dateFrom ? String((req as any).query.dateFrom) : undefined,
        dateTo: (req as any).query?.dateTo ? String((req as any).query.dateTo) : undefined,
        limit: (req as any).query?.limit ? Number((req as any).query.limit) : undefined,
      });
      (res as any).json({ success: true, data: rows });
    } catch (error) {
      next(error);
    }
  }
}
