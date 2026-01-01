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
exports.ListVouchersUseCase = exports.GetVoucherUseCase = exports.CancelVoucherUseCase = exports.PostVoucherUseCase = exports.ApproveVoucherUseCase = exports.UpdateVoucherUseCase = exports.CreateVoucherUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherPostingStrategyFactory_1 = require("../../../domain/accounting/factories/VoucherPostingStrategyFactory");
const PostingFieldExtractor_1 = require("../../../domain/accounting/services/PostingFieldExtractor");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
/**
 * CreateVoucherUseCase
 *
 * Saves a voucher in DRAFT status.
 * NEVER persists ledger lines.
 */
class CreateVoucherUseCase {
    constructor(voucherRepo, accountRepo, settingsRepo, permissionChecker, transactionManager, voucherTypeRepo) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.settingsRepo = settingsRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.voucherTypeRepo = voucherTypeRepo;
    }
    async execute(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');
        return this.transactionManager.runTransaction(async (transaction) => {
            const settings = await this.settingsRepo.getSettings(companyId, 'accounting');
            const baseCurrency = (settings === null || settings === void 0 ? void 0 : settings.baseCurrency) || payload.baseCurrency || payload.currency;
            const autoNumbering = (settings === null || settings === void 0 ? void 0 : settings.autoNumbering) !== false;
            const voucherId = payload.id || (0, crypto_1.randomUUID)();
            const voucherNo = autoNumbering ? `V-${Date.now()}` : payload.voucherNo || '';
            let lines = [];
            const voucherType = payload.type || VoucherTypes_1.VoucherType.JOURNAL_ENTRY;
            const strategy = VoucherPostingStrategyFactory_1.VoucherPostingStrategyFactory.getStrategy(voucherType);
            if (strategy) {
                const voucherTypeDef = await this.voucherTypeRepo.getByCode(companyId, voucherType);
                let strategyInput = payload;
                if (voucherTypeDef && voucherTypeDef.headerFields && voucherTypeDef.headerFields.length > 0) {
                    try {
                        strategyInput = PostingFieldExtractor_1.PostingFieldExtractor.extractPostingFields(payload, voucherTypeDef);
                    }
                    catch (error) {
                        console.warn(`PostingFieldExtractor failed for ${voucherType}:`, error.message);
                        strategyInput = payload;
                    }
                }
                lines = await strategy.generateLines(strategyInput, companyId);
            }
            else {
                // Map incoming lines to V2 VoucherLineEntity
                // Strictly V2 format (side, amount, baseAmount)
                lines = (payload.lines || []).map((l, idx) => {
                    if (!l.side || l.amount === undefined) {
                        throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VAL_REQUIRED_FIELD, `Line ${idx + 1}: Missing required V2 fields: side, amount`);
                    }
                    const fxAmount = Math.abs(Number(l.amount) || 0);
                    const baseAmt = Math.abs(Number(l.baseAmount) || fxAmount); // Fallback to FX if base missing
                    const lineCurrency = l.currency || l.lineCurrency || payload.currency || baseCurrency;
                    const lineBaseCurrency = l.baseCurrency || baseCurrency;
                    const rate = Number(l.exchangeRate) || Number(payload.exchangeRate) || 1;
                    return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, l.accountId, l.side, baseAmt, // baseAmount
                    lineBaseCurrency, // baseCurrency  
                    fxAmount, // amount
                    lineCurrency, // currency
                    rate, // exchangeRate
                    l.notes || l.description, l.costCenterId, l.metadata || {});
                });
            }
            const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
            const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
            // Build metadata including source tracking fields
            const voucherMetadata = Object.assign(Object.assign(Object.assign(Object.assign({}, payload.metadata), (payload.sourceModule && { sourceModule: payload.sourceModule })), (payload.formId && { formId: payload.formId })), (payload.prefix && { prefix: payload.prefix }));
            const voucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, voucherNo, voucherType, payload.date || new Date().toISOString().split('T')[0], payload.description || '', payload.currency || baseCurrency, baseCurrency, payload.exchangeRate || 1, lines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.DRAFT, voucherMetadata, userId, new Date());
            await this.voucherRepo.save(voucher);
            return voucher;
        });
    }
}
exports.CreateVoucherUseCase = CreateVoucherUseCase;
/**
 * UpdateVoucherUseCase
 *
 * Updates a voucher while in DRAFT/REJECTED status.
 */
class UpdateVoucherUseCase {
    constructor(voucherRepo, accountRepo, permissionChecker, policyConfigProvider) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
        this.policyConfigProvider = policyConfigProvider;
    }
    async execute(companyId, userId, voucherId, payload) {
        var _a;
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VOUCH_NOT_FOUND, 'Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.update');
        if (!voucher.canEdit) {
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VOUCH_INVALID_STATUS, `Cannot update voucher with status: ${voucher.status}. POSTED vouchers must be corrected via reverse/new.`);
        }
        // Check approval settings to determine allowed status transitions
        let approvalRequired = true; // Default to requiring approval
        if (this.policyConfigProvider) {
            try {
                const config = await this.policyConfigProvider.getConfig(companyId);
                approvalRequired = config.approvalRequired;
            }
            catch (e) {
                // If config not found, default to requiring approval
            }
        }
        // Simplified update logic: create new entity with merged data
        // In production, you would probably have a clearer mapping
        const baseCurrency = payload.baseCurrency || voucher.baseCurrency;
        const lines = payload.lines ? payload.lines.map((l, idx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, l.accountId || ((_a = voucher.lines[idx]) === null || _a === void 0 ? void 0 : _a.accountId), l.side || ((_b = voucher.lines[idx]) === null || _b === void 0 ? void 0 : _b.side), l.baseAmount || ((_c = voucher.lines[idx]) === null || _c === void 0 ? void 0 : _c.baseAmount), baseCurrency, l.amount || ((_d = voucher.lines[idx]) === null || _d === void 0 ? void 0 : _d.amount), l.currency || ((_e = voucher.lines[idx]) === null || _e === void 0 ? void 0 : _e.currency), l.exchangeRate || ((_f = voucher.lines[idx]) === null || _f === void 0 ? void 0 : _f.exchangeRate), l.notes || ((_g = voucher.lines[idx]) === null || _g === void 0 ? void 0 : _g.notes), l.costCenterId || ((_h = voucher.lines[idx]) === null || _h === void 0 ? void 0 : _h.costCenterId), Object.assign(Object.assign({}, (_j = voucher.lines[idx]) === null || _j === void 0 ? void 0 : _j.metadata), l.metadata));
        }) : voucher.lines;
        const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
        const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
        const updatedVoucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, payload.voucherNo || voucher.voucherNo, payload.type || voucher.type, payload.date || voucher.date, (_a = payload.description) !== null && _a !== void 0 ? _a : voucher.description, payload.currency || voucher.currency, baseCurrency, payload.exchangeRate || voucher.exchangeRate, lines, totalDebit, totalCredit, 
        // Allow status update only for valid transitions (respects approvalRequired setting)
        this.resolveStatus(voucher.status, payload.status, approvalRequired), Object.assign(Object.assign({}, voucher.metadata), payload.metadata), voucher.createdBy, voucher.createdAt, voucher.approvedBy, voucher.approvedAt, voucher.rejectedBy, voucher.rejectedAt, voucher.rejectionReason, voucher.lockedBy, voucher.lockedAt, voucher.postedBy, voucher.postedAt);
        await this.voucherRepo.save(updatedVoucher);
    }
    /**
     * Resolve status transition with validation.
     * Only allows valid transitions during update:
     * - If approvalRequired=true: DRAFT → PENDING (submit for approval)
     * - If approvalRequired=false: DRAFT → APPROVED (skip pending, auto-approve)
     * - REJECTED → PENDING (resubmit after rejection)
     */
    resolveStatus(currentStatus, requestedStatus, approvalRequired = true) {
        if (!requestedStatus) {
            return currentStatus;
        }
        // When requesting 'pending' (submit for approval)
        if (requestedStatus === 'pending') {
            if (currentStatus === VoucherTypes_1.VoucherStatus.DRAFT || currentStatus === VoucherTypes_1.VoucherStatus.REJECTED) {
                // If approval is required, go to PENDING. Otherwise, skip to APPROVED.
                return approvalRequired ? VoucherTypes_1.VoucherStatus.PENDING : VoucherTypes_1.VoucherStatus.APPROVED;
            }
        }
        // For other cases, keep current status (invalid transitions ignored)
        return currentStatus;
    }
}
exports.UpdateVoucherUseCase = UpdateVoucherUseCase;
/**
 * ApproveVoucherUseCase
 *
 * Sets status to APPROVED. No ledger impact.
 */
class ApproveVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
        if (voucher.status !== VoucherTypes_1.VoucherStatus.DRAFT) {
            throw new Error(`Cannot approve voucher with status: ${voucher.status}`);
        }
        const approvedVoucher = voucher.approve(userId, new Date());
        await this.voucherRepo.save(approvedVoucher);
    }
}
exports.ApproveVoucherUseCase = ApproveVoucherUseCase;
/**
 * PostVoucherUseCase
 *
 * THE SINGLE PATH FOR FINANCIAL IMPACT.
 * Freezes lines, records ledger, and sets POSTED status.
 *
 * Now includes policy validation gate:
 * 1. Core invariants (always)
 * 2. Optional policies (conditional by config)
 * 3. Then atomic post + ledger record
 */
class PostVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker, transactionManager, policyRegistry // AccountingPolicyRegistry - optional for backward compatibility
    ) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.policyRegistry = policyRegistry;
        this.validationService = new VoucherValidationService_1.VoucherValidationService();
    }
    async execute(companyId, userId, voucherId, correlationId) {
        // Import logger and uuid here to avoid circular deps
        const { logger } = await Promise.resolve().then(() => __importStar(require('../../../infrastructure/logging/StructuredLogger')));
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require('uuid')));
        const { PostingError } = await Promise.resolve().then(() => __importStar(require('../../../domain/shared/errors/AppError')));
        // Generate correlationId if not provided
        const corrId = correlationId || uuidv4();
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.post');
        return this.transactionManager.runTransaction(async (transaction) => {
            var _a;
            const voucher = await this.voucherRepo.findById(companyId, voucherId);
            if (!voucher)
                throw new Error('Voucher not found');
            // Log posting attempt
            logger.info('POST_ATTEMPT', {
                voucherId: voucher.id,
                companyId,
                userId,
                voucherType: voucher.type,
                voucherDate: voucher.date,
                correlationId: corrId
            });
            try {
                // 1. Core Invariants (Always enforced)
                try {
                    this.validationService.validateCore(voucher, corrId);
                }
                catch (error) {
                    // Log core rejection
                    logger.error('POST_REJECTED_CORE', {
                        code: ((_a = error.appError) === null || _a === void 0 ? void 0 : _a.code) || 'UNKNOWN',
                        message: error.message,
                        correlationId: corrId
                    });
                    throw error;
                }
                // 2. Optional Policies (Conditional by config)
                if (this.policyRegistry) {
                    // Load config to get policyErrorMode
                    const config = await this.policyRegistry.getConfig(companyId);
                    const policyErrorMode = config.policyErrorMode || 'FAIL_FAST';
                    // Get enabled policies for this company
                    const policies = await this.policyRegistry.getEnabledPolicies(companyId);
                    if (policies.length > 0) {
                        // Build policy context from voucher
                        const context = {
                            companyId: voucher.companyId,
                            voucherId: voucher.id,
                            userId: userId,
                            voucherType: voucher.type,
                            voucherDate: voucher.date,
                            voucherNo: voucher.voucherNo,
                            baseCurrency: voucher.baseCurrency,
                            totalDebit: voucher.totalDebit,
                            totalCredit: voucher.totalCredit,
                            status: voucher.status,
                            isApproved: voucher.isApproved,
                            lines: voucher.lines,
                            metadata: voucher.metadata
                        };
                        // Run policy validation with mode
                        try {
                            await this.validationService.validatePolicies(context, policies, policyErrorMode, corrId);
                        }
                        catch (error) {
                            // Log policy rejection
                            if (error instanceof PostingError) {
                                logger.error('POST_REJECTED_POLICY', {
                                    violationCount: error.appError.details.violations.length,
                                    violations: error.appError.details.violations,
                                    correlationId: corrId
                                });
                            }
                            throw error;
                        }
                    }
                }
                // 3. State Transition (Freezes lines + immutability check)
                const postedVoucher = voucher.post(userId, new Date());
                // 4. Single Source of Truth: Record to Ledger
                await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
                // 5. Finalizing persistence
                await this.voucherRepo.save(postedVoucher);
                // Log success
                logger.info('POST_SUCCESS', {
                    postedVoucherId: postedVoucher.id,
                    correlationId: corrId
                });
            }
            catch (error) {
                // Error already logged in specific catch blocks
                throw error;
            }
        });
    }
}
exports.PostVoucherUseCase = PostVoucherUseCase;
class CancelVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
        if (voucher.status === VoucherTypes_1.VoucherStatus.LOCKED) {
            throw new Error('Cannot cancel a locked voucher');
        }
        // If it was posted, we must delete ledger entries
        if (voucher.status === VoucherTypes_1.VoucherStatus.POSTED) {
            await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
        }
        const cancelledVoucher = voucher.reject(userId, new Date(), 'Cancelled by user');
        await this.voucherRepo.save(cancelledVoucher);
    }
}
exports.CancelVoucherUseCase = CancelVoucherUseCase;
class GetVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
        return voucher;
    }
}
exports.GetVoucherUseCase = GetVoucherUseCase;
class ListVouchersUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, limit) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
        return this.voucherRepo.findByCompany(companyId, limit);
    }
}
exports.ListVouchersUseCase = ListVouchersUseCase;
//# sourceMappingURL=VoucherUseCases.js.map