/**
 * PosController.ts — Thin controller for the POS module.
 *
 * Pattern copied from SalesController:
 *   - Reads `req.user.companyId/uid/email`
 *   - Builds a use case from `diContainer` collaborators
 *   - Maps to DTOs and returns `{ success, data }`
 *
 * Phase 0 (247a) methods: settings, registers.
 * Later phases will append shift, sale, return, report methods here.
 */
import { NextFunction, Request, Response } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PosDTOMapper } from '../../dtos/PosDTOs';
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
}
