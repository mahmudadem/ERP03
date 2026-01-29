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
exports.ListVouchersUseCase = exports.GetVoucherUseCase = exports.DeleteVoucherUseCase = exports.CancelVoucherUseCase = exports.PostVoucherUseCase = exports.ApproveVoucherUseCase = exports.UpdateVoucherUseCase = exports.CreateVoucherUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherPostingStrategyFactory_1 = require("../../../domain/accounting/factories/VoucherPostingStrategyFactory");
const PostingFieldExtractor_1 = require("../../../domain/accounting/services/PostingFieldExtractor");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const VoucherValidationService_1 = require("../../../domain/accounting/services/VoucherValidationService");
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
const AccountValidationService_1 = require("../services/AccountValidationService");
class CreateVoucherUseCase {
    constructor(voucherRepo, accountRepo, settingsRepo, permissionChecker, transactionManager, voucherTypeRepo, policyConfigProvider, ledgerRepo, // Needed for auto-post
    policyRegistry, // Needed for auto-post
    currencyRepo // NEW: Optional for backward compat in constructor, but required logic
    ) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.settingsRepo = settingsRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.voucherTypeRepo = voucherTypeRepo;
        this.policyConfigProvider = policyConfigProvider;
        this.ledgerRepo = ledgerRepo;
        this.policyRegistry = policyRegistry;
        this.currencyRepo = currencyRepo;
        this.validationService = new VoucherValidationService_1.VoucherValidationService();
    }
    async execute(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        return this.transactionManager.runTransaction(async (transaction) => {
            // Fetch settings for general config (autoNumbering, etc)
            const settings = await this.settingsRepo.getSettings(companyId, 'accounting');
            // Resolve Base Currency Strategy:
            // 1. Try Shared Currency Registry (Source of Truth) via currencyRepo
            // 2. Fallback to Module Settings (Legacy/Backup)
            let baseCurrency = null;
            if (this.currencyRepo) {
                baseCurrency = await this.currencyRepo.getBaseCurrency(companyId);
            }
            if (!baseCurrency) {
                // Fallback to legacy settings
                baseCurrency = settings === null || settings === void 0 ? void 0 : settings.baseCurrency;
            }
            baseCurrency = baseCurrency === null || baseCurrency === void 0 ? void 0 : baseCurrency.toUpperCase(); // Ensure uppercase
            if (!baseCurrency) {
                throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.CRITICAL_CONFIG_MISSING, 'Company base currency is not configured. Please complete accounting module setup through the accounting wizard.', {
                    companyId,
                    module: 'accounting',
                    missingField: 'baseCurrency',
                    hint: 'Run the accounting initialization wizard to set up base currency'
                });
            }
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
                lines = await strategy.generateLines(strategyInput, companyId, baseCurrency);
            }
            else {
                // Map incoming lines to V2 VoucherLineEntity
                // Strictly V2 format (side, amount, baseAmount)
                const accountValidationService = new AccountValidationService_1.AccountValidationService(this.accountRepo);
                lines = await Promise.all((payload.lines || []).map(async (l, idx) => {
                    if (!l.side || l.amount === undefined) {
                        throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VAL_REQUIRED_FIELD, `Line ${idx + 1}: Missing required V2 fields: side, amount`);
                    }
                    // Resolve Code to UUID for persistence
                    const account = await accountValidationService.validateAccountById(companyId, userId, l.accountId);
                    const amount = Math.abs(Number(l.amount) || 0);
                    const lineCurrency = (l.currency || l.lineCurrency || payload.currency || baseCurrency).toUpperCase();
                    const lineBaseCurrency = (l.baseCurrency || baseCurrency).toUpperCase();
                    // MULTI-CURRENCY FIX: Use triangulation formula
                    // parity = rate from Line Currency → Voucher Currency (entered by user)
                    // headerRate = rate from Voucher Currency → Base Currency (from header)
                    // baseAmount = amount × parity × headerRate
                    const parity = Number(l.parity || l.exchangeRate || 1);
                    const headerRate = Number(payload.exchangeRate || 1);
                    // The effective exchange rate for storage (Line → Base)
                    const effectiveExchangeRate = (0, VoucherLineEntity_1.roundMoney)(parity * headerRate);
                    // CRITICAL: baseAmount calculated using triangulation
                    const baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * parity * headerRate);
                    return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, account.id, // Use persistent ID
                    l.side, baseAmount, // baseAmount (Calculated via triangulation)
                    lineBaseCurrency, // baseCurrency  
                    amount, // amount (FX)
                    lineCurrency, // currency (FX)
                    effectiveExchangeRate, // exchangeRate (Line → Base, for storage)
                    l.notes || l.description, l.costCenterId, l.metadata || {});
                }));
            }
            const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
            const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
            // Build metadata including source tracking fields
            const voucherMetadata = Object.assign(Object.assign(Object.assign(Object.assign({}, payload.metadata), (payload.sourceModule && { sourceModule: payload.sourceModule })), (payload.formId && { formId: payload.formId })), (payload.prefix && { prefix: payload.prefix }));
            // Check if Approval is OFF -> Auto-Post
            let approvalRequired = true;
            if (this.policyConfigProvider) {
                try {
                    const config = await this.policyConfigProvider.getConfig(companyId);
                    approvalRequired = config.approvalRequired;
                }
                catch (e) { }
            }
            // V3: Inject creationMode for audit transparency and badge logic
            // This ensures that even before posting, the intended governance mode is clear.
            const creationMode = approvalRequired ? 'STRICT' : 'FLEXIBLE';
            const voucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, voucherNo, voucherType, payload.date || (() => {
                const now = new Date();
                return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            })(), payload.description || '', payload.currency || baseCurrency, baseCurrency, payload.exchangeRate || 1, lines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.DRAFT, Object.assign(Object.assign({}, voucherMetadata), { creationMode }), // Inject creationMode here
            userId, new Date());
            // Mode A/B Cleanup: Even if auto-posting, we MUST validate the voucher first
            // This is the "Bomb Defusal" - no voucher reaches the ledger without validation
            this.validationService.validateCore(voucher);
            await this.voucherRepo.save(voucher);
            if (!approvalRequired && this.ledgerRepo) {
                // Flexible Mode (Mode A): Auto-approve, then post inline
                // Capturing ledgerRepo to satisfy TypeScript strict null checks across async calls
                const ledgerRepo = this.ledgerRepo;
                const registry = this.policyRegistry;
                // Security: Ensure user has post permission (since we bypassed PostVoucherUseCase)
                await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.post');
                // 1. Approve the voucher
                const approvedVoucher = voucher.approve(userId, new Date());
                // 2. Determine lock policy based on current config
                let lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED;
                if (registry) {
                    try {
                        const config = await registry.getConfig(companyId);
                        // Align with PostVoucherUseCase: Check for strict gates (FA/CC)
                        const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
                        if (isStrictNow) {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
                        }
                        else if (config.allowEditPostedVouchersEnabled) {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_EDITABLE;
                        }
                        else {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED;
                        }
                    }
                    catch (e) { }
                }
                // 3. Post the approved voucher directly (don't re-fetch)
                const postedVoucher = approvedVoucher.post(userId, new Date(), lockPolicy);
                // 4. Record to ledger using captured repo
                await ledgerRepo.recordForVoucher(postedVoucher, transaction);
                // 5. Persist the posted voucher
                await this.voucherRepo.save(postedVoucher);
                return postedVoucher;
            }
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
    constructor(voucherRepo, accountRepo, permissionChecker, transactionManager, policyConfigProvider, ledgerRepo) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.policyConfigProvider = policyConfigProvider;
        this.ledgerRepo = ledgerRepo;
    }
    async execute(companyId, userId, voucherId, payload) {
        var _a, _b, _c;
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.VOUCH_NOT_FOUND, 'Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
        // Check approval settings to determine allowed status transitions
        let approvalRequired = true; // Default to requiring approval
        if (this.policyConfigProvider) {
            try {
                const config = await this.policyConfigProvider.getConfig(companyId);
                approvalRequired = config.approvalRequired;
            }
            catch (e) { }
        }
        // V3: Governance Guard for Editing Posted Vouchers
        // Determine mode and toggle from config
        let isStrictMode = true; // Default to strict
        let allowEditDeletePosted = false;
        if (this.policyConfigProvider) {
            try {
                const config = await this.policyConfigProvider.getConfig(companyId);
                console.log('[UpdateVoucherUseCase] Loaded Policy Config:', JSON.stringify(config, null, 2));
                isStrictMode = (_a = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired)) !== null && _a !== void 0 ? _a : true;
                allowEditDeletePosted = (_b = config.allowEditDeletePosted) !== null && _b !== void 0 ? _b : false;
                console.log('[UpdateVoucherUseCase] Policy Decision:', { isStrictMode, allowEditDeletePosted });
            }
            catch (e) {
                console.error('[UpdateVoucherUseCase] Failed to load config:', e);
            }
        }
        try {
            voucher.assertCanEdit(isStrictMode, allowEditDeletePosted);
        }
        catch (error) {
            const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
            const isEditForbidden = error.message.includes('VOUCHER_POSTED_EDIT_FORBIDDEN');
            let errorCode = ErrorCodes_1.ErrorCode.VOUCH_LOCKED;
            if (isStrictForever)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
            else if (isEditForbidden)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_POSTED_EDIT_FORBIDDEN;
            throw new AppError_1.BusinessError(errorCode, error.message, {
                status: voucher.status,
                isPosted: voucher.isPosted,
                postingLockPolicy: voucher.postingLockPolicy,
                httpStatus: 423
            });
        }
        // Track if voucher was posted before update (for ledger resync)
        const wasPosted = voucher.isPosted;
        // Simplified update logic: create new entity with merged data
        const accountValidationService = new AccountValidationService_1.AccountValidationService(this.accountRepo);
        // CRITICAL: baseCurrency must remain the company's base currency, never from payload
        const baseCurrency = voucher.baseCurrency.toUpperCase(); // Use existing voucher's base currency (company's base)
        const rawLines = payload.lines || voucher.lines;
        const lines = await Promise.all(rawLines.map(async (l, idx) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
            const originalLine = voucher.lines[idx];
            // 1. Resolve Account ID (UUID)
            const inputAccountId = (_a = l.accountId) !== null && _a !== void 0 ? _a : originalLine === null || originalLine === void 0 ? void 0 : originalLine.accountId;
            const account = await accountValidationService.validateAccountById(companyId, userId, inputAccountId);
            // 2. Resolve side and amounts (Handle 0 and field variations correctly)
            const side = (_b = l.side) !== null && _b !== void 0 ? _b : originalLine === null || originalLine === void 0 ? void 0 : originalLine.side;
            const currency = ((_e = (_d = (_c = l.currency) !== null && _c !== void 0 ? _c : l.lineCurrency) !== null && _d !== void 0 ? _d : originalLine === null || originalLine === void 0 ? void 0 : originalLine.currency) !== null && _e !== void 0 ? _e : baseCurrency).toUpperCase();
            const amount = Number((_g = (_f = l.amount) !== null && _f !== void 0 ? _f : originalLine === null || originalLine === void 0 ? void 0 : originalLine.amount) !== null && _g !== void 0 ? _g : 0);
            // 3. MULTI-CURRENCY FIX: Use triangulation formula
            // parity = rate from Line Currency → Voucher Currency
            // headerRate = rate from Voucher Currency → Base Currency  
            const parity = Number((_k = (_j = (_h = l.parity) !== null && _h !== void 0 ? _h : l.exchangeRate) !== null && _j !== void 0 ? _j : originalLine === null || originalLine === void 0 ? void 0 : originalLine.exchangeRate) !== null && _k !== void 0 ? _k : 1);
            const headerRate = Number((_m = (_l = payload.exchangeRate) !== null && _l !== void 0 ? _l : voucher.exchangeRate) !== null && _m !== void 0 ? _m : 1);
            // The effective exchange rate for storage (Line → Base)
            const effectiveExchangeRate = (0, VoucherLineEntity_1.roundMoney)(parity * headerRate);
            // CRITICAL: baseAmount calculated using triangulation
            const baseAmount = (0, VoucherLineEntity_1.roundMoney)(amount * parity * headerRate);
            return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, account.id, side, baseAmount, baseCurrency, amount, currency, effectiveExchangeRate, (_o = l.notes) !== null && _o !== void 0 ? _o : originalLine === null || originalLine === void 0 ? void 0 : originalLine.notes, (_p = l.costCenterId) !== null && _p !== void 0 ? _p : originalLine === null || originalLine === void 0 ? void 0 : originalLine.costCenterId, Object.assign(Object.assign({}, originalLine === null || originalLine === void 0 ? void 0 : originalLine.metadata), l.metadata));
        }));
        const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
        const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
        let updatedVoucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, payload.voucherNo || voucher.voucherNo, payload.type || voucher.type, payload.date || voucher.date, (_c = payload.description) !== null && _c !== void 0 ? _c : voucher.description, payload.currency || voucher.currency, baseCurrency, payload.exchangeRate || voucher.exchangeRate, lines, totalDebit, totalCredit, 
        // Allow status update only for valid transitions (respects approvalRequired setting)
        this.resolveStatus(voucher.status, payload.status, approvalRequired), Object.assign(Object.assign({}, voucher.metadata), payload.metadata), voucher.createdBy, voucher.createdAt, voucher.approvedBy, voucher.approvedAt, voucher.rejectedBy, voucher.rejectedAt, voucher.rejectionReason, voucher.lockedBy, voucher.lockedAt, voucher.postedBy, voucher.postedAt, voucher.postingLockPolicy, voucher.reversalOfVoucherId, payload.reference || voucher.reference, new Date());
        // If PENDING, mark as edited (Audit badge)
        if (updatedVoucher.isPending) {
            updatedVoucher = updatedVoucher.markAsEdited();
        }
        return this.transactionManager.runTransaction(async (transaction) => {
            // If the voucher was already POSTED, we must refresh ledger entries to reflect new changes
            if (voucher.isPosted) {
                if (!this.ledgerRepo)
                    throw new Error('Ledger repository required for updating posted vouchers');
                // 1. Delete old ledger records
                await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
                // 2. Save updated voucher
                await this.voucherRepo.save(updatedVoucher);
                // 3. Re-record to ledger
                await this.ledgerRepo.recordForVoucher(updatedVoucher, transaction);
            }
            else {
                // Standard save
                await this.voucherRepo.save(updatedVoucher);
            }
        });
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
 * Satisfies the Financial Approval (FA) gate.
 * If no other gates (like CC) are pending, transitions status to APPROVED.
 */
class ApproveVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        var _a, _b, _c;
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.approve');
        if (voucher.status !== VoucherTypes_1.VoucherStatus.PENDING) {
            throw new Error(`Cannot approve voucher with status: ${voucher.status}. Voucher must be in PENDING status.`);
        }
        // 1. Check if FA is required and pending
        const isFARequired = !!((_a = voucher.metadata) === null || _a === void 0 ? void 0 : _a.financialApprovalRequired);
        const isFAPending = !!((_b = voucher.metadata) === null || _b === void 0 ? void 0 : _b.pendingFinancialApproval);
        if (!isFAPending && isFARequired) {
            // Already satisfied
            return;
        }
        // 2. Determine if this satisfies ALL gates
        // CC is satisfied if the list is empty
        const pendingCC = ((_c = voucher.metadata) === null || _c === void 0 ? void 0 : _c.pendingCustodyConfirmations) || [];
        const isFullySatisfied = pendingCC.length === 0;
        // 3. Transition
        const approvedVoucher = voucher.satisfyFinancialApproval(userId, new Date(), isFullySatisfied);
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
    constructor(voucherRepo, ledgerRepo, permissionChecker, transactionManager, accountValidationService, policyRegistry // AccountingPolicyRegistry - optional for backward compatibility
    ) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.accountValidationService = accountValidationService;
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
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.post');
        return this.transactionManager.runTransaction(async (transaction) => {
            var _a;
            const voucher = await this.voucherRepo.findById(companyId, voucherId);
            if (!voucher)
                throw new Error('Voucher not found');
            // IDEMPOTENCY FIX: If already posted, return safely.
            // This allows controllers to blindly request "Post this approved voucher" without error.
            if (voucher.isPosted) {
                logger.info('POST_SKIPPED_ALREADY_POSTED', {
                    voucherId: voucher.id,
                    correlationId: corrId
                });
                return;
            }
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
                    // Validate and Resolve all accounts used in lines (existence, status, role, currency policy)
                    const distinctAccountRawIds = [...new Set(voucher.lines.map(l => l.accountId))];
                    const resolvedAccountsMap = new Map();
                    await Promise.all(distinctAccountRawIds.map(async (accId) => {
                        const account = await this.accountValidationService.validateAccountById(companyId, userId, accId, voucher.type);
                        resolvedAccountsMap.set(accId, account.id);
                    }));
                    // NORMALIZATION: If any accountId in the voucher lines is a code, we must re-create the voucher
                    // with actual IDs before posting to the ledger.
                    const needsNormalization = voucher.lines.some(l => resolvedAccountsMap.get(l.accountId) !== l.accountId);
                    if (needsNormalization) {
                        const normalizedLines = voucher.lines.map(l => new VoucherLineEntity_1.VoucherLineEntity(l.id, resolvedAccountsMap.get(l.accountId), l.side, l.baseAmount, l.baseCurrency, l.amount, l.currency, l.exchangeRate, l.notes, l.costCenterId, l.metadata));
                        // Re-instantiate voucher with normalized lines
                        // We can't mutate VoucherEntity (immutable), but we can create a projected copy for posting
                        // However, voucher.post() returns a new entity, so we can just use the normalized lines there.
                        voucher.lines = normalizedLines; // TEMPORARY mutation for posting logic if needed, 
                        // but cleaner is to pass it to post. 
                        // Looking at VoucherEntity.post, it uses this.lines.
                    }
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
                // 3. State Transition (Freezes lines + Mode Snapshotting)
                let lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED;
                if (this.policyRegistry) {
                    try {
                        const config = await this.policyRegistry.getConfig(companyId);
                        const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
                        if (isStrictNow) {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
                        }
                        else if (config.allowEditPostedVouchersEnabled) {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_EDITABLE;
                        }
                        else {
                            lockPolicy = VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED;
                        }
                    }
                    catch (e) { }
                }
                const postedVoucher = voucher.post(userId, new Date(), lockPolicy);
                // 4. Single Source of Truth: Record to Ledger
                await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
                // 5. Finalizing persistence
                await this.voucherRepo.save(postedVoucher);
                // EXTRA: If this is a reversal, officially mark the original as reversed
                if (postedVoucher.reversalOfVoucherId) {
                    const originalVoucher = await this.voucherRepo.findById(companyId, postedVoucher.reversalOfVoucherId);
                    if (originalVoucher) {
                        const reversedOriginal = originalVoucher.markAsReversed(postedVoucher.id);
                        await this.voucherRepo.save(reversedOriginal);
                    }
                }
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
    constructor(voucherRepo, ledgerRepo, permissionChecker, policyConfigProvider) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.policyConfigProvider = policyConfigProvider;
    }
    async execute(companyId, userId, voucherId) {
        var _a, _b;
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');
        // V3: Governance Guard for Deleting Posted Vouchers
        let isStrictMode = true; // Default to strict
        let allowEditDeletePosted = false;
        if (this.policyConfigProvider) {
            try {
                const config = await this.policyConfigProvider.getConfig(companyId);
                isStrictMode = (_a = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired)) !== null && _a !== void 0 ? _a : true;
                allowEditDeletePosted = (_b = config.allowEditDeletePosted) !== null && _b !== void 0 ? _b : false;
            }
            catch (e) { }
        }
        try {
            voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
        }
        catch (error) {
            const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
            const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
            let errorCode = ErrorCodes_1.ErrorCode.VOUCH_LOCKED;
            if (isStrictForever)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
            else if (isDeleteForbidden)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
            throw new AppError_1.BusinessError(errorCode, `Cannot delete voucher: ${error.message}`, {
                status: voucher.status,
                isPosted: voucher.isPosted,
                postingLockPolicy: voucher.postingLockPolicy,
                httpStatus: 423
            });
        }
        // V1: If voucher was posted, delete ledger entries
        if (voucher.isPosted) {
            await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
        }
        const cancelledVoucher = voucher.cancel(userId, new Date(), 'Deleted by user');
        await this.voucherRepo.save(cancelledVoucher);
    }
}
exports.CancelVoucherUseCase = CancelVoucherUseCase;
class DeleteVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker, configProvider) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.configProvider = configProvider;
    }
    async execute(companyId, userId, voucherId) {
        var _a, _b;
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        // Explicit DELETE permission check (distinct from CANCEL)
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');
        // Load policy
        let config;
        try {
            config = await this.configProvider.getConfig(companyId);
        }
        catch (e) {
            config = {};
        }
        // Policy Check - Align with PostVoucherUseCase & UpdateVoucherUseCase
        const isStrictMode = (_a = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired)) !== null && _a !== void 0 ? _a : true;
        const allowEditDeletePosted = (_b = config.allowEditDeletePosted) !== null && _b !== void 0 ? _b : false;
        try {
            voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
        }
        catch (error) {
            const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
            const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
            let errorCode = ErrorCodes_1.ErrorCode.VOUCH_LOCKED;
            if (isStrictForever)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
            else if (isDeleteForbidden)
                errorCode = ErrorCodes_1.ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
            throw new AppError_1.BusinessError(errorCode, `Cannot delete voucher: ${error.message}`, { httpStatus: 423 });
        }
        // Clean up ledger entries if posted
        if (voucher.isPosted) {
            await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
        }
        // HARD DELETE the voucher record
        await this.voucherRepo.delete(companyId, voucherId);
    }
}
exports.DeleteVoucherUseCase = DeleteVoucherUseCase;
class GetVoucherUseCase {
    constructor(voucherRepo, permissionChecker) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
    }
    async execute(companyId, userId, voucherId) {
        const voucher = await this.voucherRepo.findById(companyId, voucherId);
        if (!voucher)
            throw new Error('Voucher not found');
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
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
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
        return this.voucherRepo.findByCompany(companyId, limit);
    }
}
exports.ListVouchersUseCase = ListVouchersUseCase;
//# sourceMappingURL=VoucherUseCases.js.map