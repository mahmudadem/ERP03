"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const VoucherUseCases_1 = require("../../../application/accounting/use-cases/VoucherUseCases");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const AccountValidationService_1 = require("../../../application/accounting/services/AccountValidationService");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class VoucherController {
    static async list(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.ListVouchersUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
            const vouchers = await useCase.execute(companyId, userId, limit);
            res.json({ success: true, data: vouchers });
        }
        catch (err) {
            next(err);
        }
    }
    static async get(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.GetVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const voucher = await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true, data: voucher });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.CreateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.voucherTypeDefinitionRepository, bindRepositories_1.diContainer.accountingPolicyConfigProvider, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.policyRegistry);
            const voucher = await useCase.execute(companyId, userId, req.body);
            res.json({ success: true, data: voucher });
        }
        catch (err) {
            next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.UpdateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.accountingPolicyConfigProvider, bindRepositories_1.diContainer.ledgerRepository);
            await useCase.execute(companyId, userId, req.params.id, req.body);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Submit voucher for approval (Draft → Pending)
     * Used when strictApprovalMode / financialApprovalEnabled is ON
     */
    static async approve(req, res, next) {
        var _a;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            // Use SubmitVoucherUseCase for Draft → Pending transition
            const { SubmitVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/SubmitVoucherUseCase')));
            const { ApprovalPolicyService } = await Promise.resolve().then(() => __importStar(require('../../../domain/accounting/policies/ApprovalPolicyService')));
            const { VoucherStatus } = await Promise.resolve().then(() => __importStar(require('../../../domain/accounting/types/VoucherTypes')));
            // Create account metadata getter that fetches actual account data
            const getAccountMetadata = async (cid, accountIds) => {
                const accounts = await Promise.all(accountIds.map(id => bindRepositories_1.diContainer.accountRepository.getById(cid, id)));
                return accounts
                    .filter(acc => acc !== null)
                    .map(acc => ({
                    accountId: acc.id,
                    requiresApproval: acc.requiresApproval || false,
                    requiresCustodyConfirmation: acc.requiresCustodyConfirmation || false,
                    custodianUserId: acc.custodianUserId || undefined
                }));
            };
            const submitUseCase = new SubmitVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountingPolicyConfigProvider, new ApprovalPolicyService(), getAccountMetadata);
            let voucher = await submitUseCase.execute(companyId, req.params.id, userId);
            // V1: AUTO-POST only if voucher is APPROVED AND autoPostEnabled=true
            if (voucher.status === VoucherStatus.APPROVED) {
                // Check autoPostEnabled setting
                let autoPostEnabled = true; // Default: true
                try {
                    const config = await bindRepositories_1.diContainer.accountingPolicyConfigProvider.getConfig(companyId);
                    autoPostEnabled = (_a = config.autoPostEnabled) !== null && _a !== void 0 ? _a : true;
                }
                catch (e) {
                    // If config fails, default to auto-post enabled
                }
                if (autoPostEnabled) {
                    const { PostVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherUseCases')));
                    const postUseCase = new PostVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository), bindRepositories_1.diContainer.policyRegistry);
                    await postUseCase.execute(companyId, userId, req.params.id);
                    // Refresh voucher data after posting to get postedAt and updated metadata
                    const postedVoucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, req.params.id);
                    if (postedVoucher) {
                        voucher = postedVoucher;
                    }
                    return res.json({
                        success: true,
                        data: voucher.toJSON(),
                        message: 'Voucher submitted and posted'
                    });
                }
                else {
                    // V1: autoPostEnabled=false - Voucher stays APPROVED but NOT POSTED
                    return res.json({
                        success: true,
                        data: voucher.toJSON(),
                        message: 'Voucher approved (posting disabled - manual post required)'
                    });
                }
            }
            res.json({ success: true, data: voucher.toJSON(), message: 'Voucher submitted for approval' });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Verify/Approve voucher (Pending → Approved → Posted)
     * Final approval by manager, satisfies the Financial Approval gate
     */
    static async verify(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            // 1. Approve the voucher (Pending → Approved)
            const useCase = new VoucherUseCases_1.ApproveVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            // 2. AUTO-POST after approval (seamlessly transition to POSTED status)
            const { PostVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherUseCases')));
            const postUseCase = new PostVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository), bindRepositories_1.diContainer.policyRegistry);
            await postUseCase.execute(companyId, userId, req.params.id);
            // Refresh to get latest state for frontend
            const voucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, req.params.id);
            res.json({
                success: true,
                data: voucher ? voucher.toJSON() : null,
                message: 'Voucher approved and posted'
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Confirm custody of a voucher (Gate satisfaction)
     * Triggered by designated custodians for specific accounts.
     */
    static async confirm(req, res, next) {
        var _a;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { ConfirmCustodyUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/ConfirmCustodyUseCase')));
            const { ApprovalPolicyService } = await Promise.resolve().then(() => __importStar(require('../../../domain/accounting/policies/ApprovalPolicyService')));
            const useCase = new ConfirmCustodyUseCase(bindRepositories_1.diContainer.voucherRepository, new ApprovalPolicyService());
            let voucher = await useCase.execute(companyId, req.params.id, userId);
            // If this confirmation satisfied ALL gates, it is now APPROVED.
            // We should check for auto-post here as well for seamless UX.
            const { VoucherStatus } = await Promise.resolve().then(() => __importStar(require('../../../domain/accounting/types/VoucherTypes')));
            if (voucher.status === VoucherStatus.APPROVED) {
                let autoPostEnabled = true;
                try {
                    const config = await bindRepositories_1.diContainer.accountingPolicyConfigProvider.getConfig(companyId);
                    autoPostEnabled = (_a = config.autoPostEnabled) !== null && _a !== void 0 ? _a : true;
                }
                catch (e) { }
                if (autoPostEnabled) {
                    const { PostVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherUseCases')));
                    const postUseCase = new PostVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository), bindRepositories_1.diContainer.policyRegistry);
                    await postUseCase.execute(companyId, userId, req.params.id);
                    const postedVoucher = await bindRepositories_1.diContainer.voucherRepository.findById(companyId, req.params.id);
                    if (postedVoucher)
                        voucher = postedVoucher;
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List vouchers pending financial approval for the company
     */
    static async getPendingApprovals(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const vouchers = await bindRepositories_1.diContainer.voucherRepository.findPendingFinancialApprovals(companyId);
            res.json({ success: true, data: vouchers.map(v => v.toJSON()) });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * List vouchers pending custody confirmation for the current user
     */
    static async getPendingCustody(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const vouchers = await bindRepositories_1.diContainer.voucherRepository.findPendingCustodyConfirmations(companyId, userId);
            res.json({ success: true, data: vouchers.map(v => v.toJSON()) });
        }
        catch (err) {
            next(err);
        }
    }
    static async post(req, res, next) {
        try {
            // SECURITY: userId must come from auth context only
            const companyId = req.user.companyId;
            const userId = req.user.uid;
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
            const { PostVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherUseCases')));
            const { PostingError } = await Promise.resolve().then(() => __importStar(require('../../../domain/shared/errors/AppError')));
            const useCase = new PostVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository), bindRepositories_1.diContainer.policyRegistry);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            // Handle PostingError with standardized envelope
            if (err.name === 'PostingError') {
                return res.status(400).json(err.toJSON());
            }
            next(err);
        }
    }
    static async reject(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { reason } = req.body;
            const { RejectVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherApprovalUseCases')));
            const useCase = new RejectVoucherUseCase(bindRepositories_1.diContainer.voucherRepository);
            const voucher = await useCase.execute(companyId, req.params.id, userId, reason || 'Rejected by approver');
            res.json({
                success: true,
                data: voucher.toJSON(),
                message: 'Voucher rejected'
            });
        }
        catch (err) {
            next(err);
        }
    }
    static async correct(req, res, next) {
        try {
            // SECURITY: userId must come from auth context only
            const companyId = req.user.companyId;
            const userId = req.user.uid;
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
            const { ReverseAndReplaceVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/ReverseAndReplaceVoucherUseCase')));
            const useCase = new ReverseAndReplaceVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.policyRegistry, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository, bindRepositories_1.diContainer.accountingPolicyConfigProvider);
            const { correctionMode, replacePayload, options } = req.body;
            const result = await useCase.execute(companyId, userId, req.params.id, correctionMode, replacePayload, options);
            res.json({ success: true, data: result });
        }
        catch (err) {
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
    static async cancel(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.CancelVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.accountingPolicyConfigProvider);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async delete(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { DeleteVoucherUseCase } = await Promise.resolve().then(() => __importStar(require('../../../application/accounting/use-cases/VoucherUseCases')));
            const useCase = new DeleteVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.accountingPolicyConfigProvider);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true, message: 'Voucher permanently deleted' });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VoucherController = VoucherController;
//# sourceMappingURL=VoucherController.js.map