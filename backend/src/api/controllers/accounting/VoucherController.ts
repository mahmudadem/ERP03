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
      
      // Create account metadata getter (simplified - returns empty for now, will be enhanced)
      const getAccountMetadata = async (cid: string, accountIds: string[]) => {
        // TODO: Fetch actual account metadata with requiresApproval/custodianUserId
        return accountIds.map(id => ({
          accountId: id,
          requiresApproval: true, // Default to require approval when FA is enabled
          requiresCustodyConfirmation: false,
          custodianUserId: undefined
        }));
      };
      
      const submitUseCase = new SubmitVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.accountingPolicyConfigProvider as any,
        new ApprovalPolicyService(),
        getAccountMetadata
      );
      
      const voucher = await submitUseCase.execute(companyId, req.params.id, userId);
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
      
      // 1. Approve the voucher (Pending → Approved)
      const useCase = new ApproveVoucherUseCase(diContainer.voucherRepository as any, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      
      // 2. AUTO-POST after approval (seamlessly transition to POSTED status)
      const { PostVoucherUseCase } = await import('../../../application/accounting/use-cases/VoucherUseCases');
      const postUseCase = new PostVoucherUseCase(
        diContainer.voucherRepository as any,
        diContainer.ledgerRepository as any,
        permissionChecker,
        diContainer.transactionManager as any,
        diContainer.policyRegistry as any
      );
      await postUseCase.execute(companyId, userId, req.params.id);

      res.json({ success: true, message: 'Voucher approved and posted' });
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
        diContainer.companyModuleSettingsRepository as any
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
      const useCase = new CancelVoucherUseCase(diContainer.voucherRepository as any, diContainer.ledgerRepository as any, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
