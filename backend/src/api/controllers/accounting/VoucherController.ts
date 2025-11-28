
/**
 * VoucherController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { 
  CreateVoucherUseCase, 
  ApproveVoucherUseCase, 
  LockVoucherUseCase,
  CancelVoucherUseCase,
  GetVoucherUseCase,
  ListVouchersUseCase,
  UpdateVoucherDraftUseCase
} from '../../../application/accounting/use-cases/VoucherUseCases';
import { RecalculateVoucherTotalsUseCase } from '../../../application/accounting/use-cases/VoucherLineUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { AccountingDTOMapper } from '../../dtos/AccountingDTOs';
import { validateCreateVoucherInput } from '../../validators/accounting.validators';
import { ApiError } from '../../errors/ApiError';

export class VoucherController {
  
  static async createVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      validateCreateVoucherInput((req as any).body);
      
      const useCase = new CreateVoucherUseCase(diContainer.voucherRepository);
      
      // Convert date string to Date object
      const payload = {
        ...(req as any).body,
        date: new Date((req as any).body.date),
        exchangeRate: (req as any).body.exchangeRate || 1,
        createdBy: (req as any).user?.uid || 'system'
      };

      const voucher = await useCase.execute(payload);

      // Recalculate totals immediately (since CreateUseCase in MVP calculates but Recalc is cleaner)
      // or we trust CreateUseCase. 
      // Let's assume CreateUseCase returned the Header.
      // In a real app we'd save lines here too.

      (res as any).status(201).json({
        success: true,
        data: AccountingDTOMapper.toVoucherDTO(voucher)
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateVoucherDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const id = (req as any).params.id;
      const useCase = new UpdateVoucherDraftUseCase(diContainer.voucherRepository);
      
      const updateData = { ... (req as any).body };
      if (updateData.date) updateData.date = new Date(updateData.date);

      await useCase.execute(id, updateData);

      // If lines were sent, we'd update them and recalculate totals
      if ((req as any).body.lines) {
        const recalc = new RecalculateVoucherTotalsUseCase(diContainer.voucherRepository);
        await recalc.execute(id, (req as any).body.lines);
      }

      (res as any).status(200).json({ success: true, message: 'Voucher updated' });
    } catch (error) {
      next(error);
    }
  }

  static async approveVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ApproveVoucherUseCase(diContainer.voucherRepository);
      await useCase.execute((req as any).params.id);
      (res as any).status(200).json({ success: true, message: 'Voucher approved' });
    } catch (error) {
      next(error);
    }
  }

  static async lockVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new LockVoucherUseCase(diContainer.voucherRepository);
      await useCase.execute((req as any).params.id);
      (res as any).status(200).json({ success: true, message: 'Voucher locked' });
    } catch (error) {
      next(error);
    }
  }

  static async cancelVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CancelVoucherUseCase(diContainer.voucherRepository);
      await useCase.execute((req as any).params.id);
      (res as any).status(200).json({ success: true, message: 'Voucher cancelled' });
    } catch (error) {
      next(error);
    }
  }

  static async getVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new GetVoucherUseCase(diContainer.voucherRepository);
      const voucher = await useCase.execute((req as any).params.id);
      
      // In MVP, Voucher Entity doesn't hold lines. 
      // We would fetch lines from a separate repo or assume they are embedded if using NoSQL.
      // For this step, we'll return empty lines array if not implemented in repo.
      
      (res as any).status(200).json({
        success: true,
        data: AccountingDTOMapper.toVoucherDTO(voucher, []) 
      });
    } catch (error) {
      next(error);
    }
  }

  static async listVouchers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');

      const useCase = new ListVouchersUseCase(diContainer.voucherRepository);
      const vouchers = await useCase.execute(companyId, (req as any).query);

      (res as any).status(200).json({
        success: true,
        data: vouchers.map(v => AccountingDTOMapper.toVoucherDTO(v))
      });
    } catch (error) {
      next(error);
    }
  }
}
