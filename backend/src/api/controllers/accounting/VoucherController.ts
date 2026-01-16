import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateVoucherUseCase,
  UpdateVoucherUseCase,
  ApproveVoucherUseCase,
  CancelVoucherUseCase,
  GetVoucherUseCase,
  ListVouchersUseCase,
} from '../../../application/accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { AccountValidationService } from '../../../application/accounting/services/AccountValidationService';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class VoucherController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new ListVouchersUseCase(diContainer.voucherRepository as any, permissionChecker);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const vouchers = await useCase.execute(companyId, userId, limit);
      res.json({ success: true, data: vouchers });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new GetVoucherUseCase(diContainer.voucherRepository as any, permissionChecker);
      const voucher = await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new CreateVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.accountRepository as any,
        diContainer.companyModuleSettingsRepository as any,
        permissionChecker,
        diContainer.transactionManager as any,
        diContainer.voucherTypeDefinitionRepository as any,
        diContainer.accountingPolicyConfigProvider as any,
        diContainer.ledgerRepository as any,
        diContainer.policyRegistry as any
      );
      const voucher = await useCase.execute(companyId, userId, req.body);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new UpdateVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.accountRepository as any,
        permissionChecker,
        diContainer.transactionManager as any,
        diContainer.accountingPolicyConfigProvider as any,
        diContainer.ledgerRepository as any
      );
      await useCase.execute(companyId, userId, req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Submit voucher for approval (Draft → Pending)
   * Used when strictApprovalMode / financialApprovalEnabled is ON
   */
  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      // Use SubmitVoucherUseCase for Draft → Pending transition
      const { SubmitVoucherUseCase } = await import('../../../application/accounting/use-cases/SubmitVoucherUseCase');
      const { ApprovalPolicyService } = await import('../../../domain/accounting/policies/ApprovalPolicyService');
      const { VoucherStatus } = await import('../../../domain/accounting/types/VoucherTypes');
      
      // Create account metadata getter that fetches actual account data
      const getAccountMetadata = async (cid: string, accountIds: string[]) => {
        const accounts = await Promise.all(
          accountIds.map(id => diContainer.accountRepository.getById(cid, id))
        );
        return accounts
          .filter(acc => acc !== null)
          .map(acc => ({
            accountId: acc!.id,
            requiresApproval: acc!.requiresApproval || false,
            requiresCustodyConfirmation: acc!.requiresCustodyConfirmation || false,
            custodianUserId: acc!.custodianUserId || undefined
          }));
      };
      
      const submitUseCase = new SubmitVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.accountingPolicyConfigProvider as any,
        new ApprovalPolicyService(),
        getAccountMetadata
      );
      
      let voucher = await submitUseCase.execute(companyId, req.params.id, userId);

      // V1: AUTO-POST only if voucher is APPROVED AND autoPostEnabled=true
      if (voucher.status === VoucherStatus.APPROVED) {
        // Check autoPostEnabled setting
        let autoPostEnabled = true;  // Default: true
        try {
          const config = await diContainer.accountingPolicyConfigProvider.getConfig(companyId);
          autoPostEnabled = config.autoPostEnabled ?? true;
        } catch (e) {
          // If config fails, default to auto-post enabled
        }
        
        if (autoPostEnabled) {
          const { PostVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
          const postUseCase = new PostVoucherUseCase(
            diContainer.voucherRepository as any,
            diContainer.ledgerRepository as any,
            permissionChecker,
            diContainer.transactionManager as any,
            new AccountValidationService(diContainer.accountRepository as any),
            diContainer.policyRegistry as any
          );
          await postUseCase.execute(companyId, userId, req.params.id);
          
          // Refresh voucher data after posting to get postedAt and updated metadata
          const postedVoucher = await diContainer.voucherRepository.findById(companyId, req.params.id);
          if (postedVoucher) {
            voucher = postedVoucher;
          }
          
          return res.json({ 
            success: true, 
            data: voucher.toJSON(), 
            message: 'Voucher submitted and posted' 
          });
        } else {
          // V1: autoPostEnabled=false - Voucher stays APPROVED but NOT POSTED
          return res.json({ 
            success: true, 
            data: voucher.toJSON(), 
            message: 'Voucher approved (posting disabled - manual post required)' 
          });
        }
      }
      
      res.json({ success: true, data: voucher.toJSON(), message: 'Voucher submitted for approval' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Verify/Approve voucher (Pending → Approved → Posted)
   * Final approval by manager, satisfies the Financial Approval gate
   */
  static async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      // 1. Approve the voucher (Pending → Approved OR stays PENDING if more gates exist)
      const useCase = new ApproveVoucherUseCase(diContainer.voucherRepository as any, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      
      // 2. Load updated state
      let voucher = await diContainer.voucherRepository.findById(companyId, req.params.id);
      if (!voucher) throw new Error('Voucher not found after approval');

      // 3. AUTO-POST ONLY if fully approved
      const { VoucherStatus } = await import('../../../domain/accounting/types/VoucherTypes');
      if (voucher.status === VoucherStatus.APPROVED) {
        let autoPostEnabled = true;
        try {
          const config = await diContainer.accountingPolicyConfigProvider.getConfig(companyId);
          autoPostEnabled = config.autoPostEnabled ?? true;
        } catch (e) {}

        if (autoPostEnabled) {
          const { PostVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
          const postUseCase = new PostVoucherUseCase(
            diContainer.voucherRepository as any,
            diContainer.ledgerRepository as any,
            permissionChecker,
            diContainer.transactionManager as any,
            new AccountValidationService(diContainer.accountRepository as any),
            diContainer.policyRegistry as any
          );
          await postUseCase.execute(companyId, userId, req.params.id);
          
          // Refresh to get posted version
          const postedVoucher = await diContainer.voucherRepository.findById(companyId, req.params.id);
          if (postedVoucher) voucher = postedVoucher;
        }
      }

      res.json({ 
        success: true, 
        data: voucher.toJSON(),
        message: voucher.status === VoucherStatus.APPROVED 
          ? (voucher.isPosted ? 'Voucher approved and posted' : 'Voucher approved')
          : 'Financial approval recorded (awaiting custody confirmation)' 
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Confirm custody of a voucher (Gate satisfaction)
   * Triggered by designated custodians for specific accounts.
   */
  static async confirm(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      const { ConfirmCustodyUseCase } = await import('../../../application/accounting/use-cases/ConfirmCustodyUseCase');
      const { ApprovalPolicyService } = await import('../../../domain/accounting/policies/ApprovalPolicyService');
      
      const useCase = new ConfirmCustodyUseCase(
        diContainer.voucherRepository as any,
        new ApprovalPolicyService()
      );
      
      let voucher = await useCase.execute(companyId, req.params.id, userId);

      // If this confirmation satisfied ALL gates, it is now APPROVED.
      // We should check for auto-post here as well for seamless UX.
      const { VoucherStatus } = await import('../../../domain/accounting/types/VoucherTypes');
      if (voucher.status === VoucherStatus.APPROVED) {
        let autoPostEnabled = true;
        try {
          const config = await diContainer.accountingPolicyConfigProvider.getConfig(companyId);
          autoPostEnabled = config.autoPostEnabled ?? true;
        } catch (e) {}

        if (autoPostEnabled) {
          const { PostVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
          const postUseCase = new PostVoucherUseCase(
            diContainer.voucherRepository as any,
            diContainer.ledgerRepository as any,
            permissionChecker,
            diContainer.transactionManager as any,
            new AccountValidationService(diContainer.accountRepository as any),
            diContainer.policyRegistry as any
          );
          await postUseCase.execute(companyId, userId, req.params.id);
          
          const postedVoucher = await diContainer.voucherRepository.findById(companyId, req.params.id);
          if (postedVoucher) voucher = postedVoucher;

          return res.json({ 
            success: true, 
            data: voucher.toJSON(), 
            message: 'Custody confirmed and voucher posted' 
          });
        }
      }

      res.json({ 
        success: true, 
        data: voucher.toJSON(), 
        message: 'Custody confirmed' 
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List vouchers pending financial approval for the company
   */
  static async getPendingApprovals(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const vouchers = await diContainer.voucherRepository.findPendingFinancialApprovals(companyId);
      res.json({ success: true, data: vouchers.map(v => v.toJSON()) });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List vouchers pending custody confirmation for the current user
   */
  static async getPendingCustody(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const vouchers = await diContainer.voucherRepository.findPendingCustodyConfirmations(companyId, userId);
      res.json({ success: true, data: vouchers.map(v => v.toJSON()) });
    } catch (err) {
      next(err);
    }
  }



  static async post(req: Request, res: Response, next: NextFunction) {
    try {
      // SECURITY: userId must come from auth context only
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // SECURITY: Reject if request body attempts to override userId
      if (req.body && req.body.userId !== undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'USER_ID_NOT_ALLOWED',
            message: 'userId cannot be provided in request body. It is derived from authentication context.'
          }
        });
      }

      const { PostVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
      const { PostingError } = await import('../../../domain/shared/errors/AppError');
      
      const useCase = new PostVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.ledgerRepository as any,
        permissionChecker,
        diContainer.transactionManager as any,
        new AccountValidationService(diContainer.accountRepository as any),
        diContainer.policyRegistry as any
      );

      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      // Handle PostingError with standardized envelope
      if (err.name === 'PostingError') {
        return res.status(400).json(err.toJSON());
      }
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { reason } = req.body;

      const { RejectVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherApprovalUseCases');
      const useCase = new RejectVoucherUseCase(diContainer.voucherRepository as any);
      const voucher = await useCase.execute(companyId, req.params.id, userId, reason || 'Rejected by approver');

      res.json({ 
        success: true, 
        data: voucher.toJSON(),
        message: 'Voucher rejected' 
      });
    } catch (err) {
      next(err);
    }
  }

  static async correct(req: Request, res: Response, next: NextFunction) {
    try {
      // SECURITY: userId must come from auth context only
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      // SECURITY: Reject if request body attempts to override userId
      if (req.body && req.body.userId !== undefined) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'USER_ID_NOT_ALLOWED',
            message: 'userId cannot be provided in request body. It is derived from authentication context.'
          }
        });
      }

      const { ReverseAndReplaceVoucherUseCase } = await import('../../../application/accounting/use-cases/ReverseAndReplaceVoucherUseCase');
      const useCase = new ReverseAndReplaceVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.ledgerRepository as any,
        permissionChecker,
        diContainer.transactionManager as any,
        diContainer.policyRegistry as any,
        diContainer.accountRepository as any,
        diContainer.companyModuleSettingsRepository as any,
        diContainer.accountingPolicyConfigProvider as any
      );

      const { correctionMode, replacePayload, options } = req.body;

      const result = await useCase.execute(
        companyId,
        userId,
        req.params.id,
        correctionMode,
        replacePayload,
        options
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Lock endpoint disabled - use case not implemented
  /*
  static async lock(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new LockVoucherUseCase(diContainer.voucherRepository, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
  */

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new CancelVoucherUseCase(
        diContainer.voucherRepository as any, 
        diContainer.ledgerRepository as any, 
        permissionChecker,
        diContainer.accountingPolicyConfigProvider as any
      );
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      const { DeleteVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
      
      const useCase = new DeleteVoucherUseCase(
        diContainer.voucherRepository as any, 
        diContainer.ledgerRepository as any, 
        permissionChecker,
        diContainer.accountingPolicyConfigProvider as any
      );
      
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true, message: 'Voucher permanently deleted' });
    } catch (err) {
      next(err);
    }
  }
}
