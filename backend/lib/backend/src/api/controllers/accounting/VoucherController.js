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
            const useCase = new VoucherUseCases_1.CreateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
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
            const useCase = new VoucherUseCases_1.UpdateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id, req.body);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async approve(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.ApproveVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
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
            const useCase = new PostVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.policyRegistry);
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
            const useCase = new ReverseAndReplaceVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.policyRegistry, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository);
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
            const useCase = new VoucherUseCases_1.CancelVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VoucherController = VoucherController;
//# sourceMappingURL=VoucherController.js.map