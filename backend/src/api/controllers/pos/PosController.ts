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
import { PosDTOMapper, PosCashMovementDTO, PosXReportDTO } from '../../dtos/PosDTOs';
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
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { SubledgerVoucherPostingService } from '../../../application/accounting/services/SubledgerVoucherPostingService';
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
        diContainer.salesSettingsRepository
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
}
