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
const UI_ONLY_VOUCHER_KEYS = new Set([
    'voucherConfig',
    'headerFields',
    'tableColumns',
    'uiModeOverrides',
    'tableStyle',
    'actions',
    'rules',
    '_isForm',
    '_rowId'
]);
const LEGACY_SOURCE_KEYS = new Set(['sourceVoucher', 'sourcePayload']);
const SYSTEM_MANAGED_SOURCE_FIELDS = new Set([
    'id',
    'voucherNo',
    'voucherNumber',
    'status',
    'createdBy',
    'createdAt',
    'updatedBy',
    'updatedAt',
    'approvedBy',
    'approvedAt',
    'rejectedBy',
    'rejectedAt',
    'postedBy',
    'postedAt',
    'postingLockPolicy'
]);
const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};
const sanitizeSnapshotValue = (value) => {
    if (value === undefined)
        return undefined;
    if (value === null)
        return null;
    if (Array.isArray(value)) {
        return value
            .map((entry) => sanitizeSnapshotValue(entry))
            .filter((entry) => entry !== undefined);
    }
    if (!isPlainObject(value))
        return value;
    const out = {};
    Object.entries(value).forEach(([key, entry]) => {
        if (!key)
            return;
        if (UI_ONLY_VOUCHER_KEYS.has(key) || LEGACY_SOURCE_KEYS.has(key))
            return;
        const sanitized = sanitizeSnapshotValue(entry);
        if (sanitized === undefined)
            return;
        out[key] = sanitized;
    });
    return out;
};
const normalizeVoucherTypeCode = (rawType, fallback = VoucherTypes_1.VoucherType.JOURNAL_ENTRY) => {
    const normalized = String(rawType || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (!normalized)
        return fallback;
    if (normalized === 'jv' || normalized === 'journal')
        return VoucherTypes_1.VoucherType.JOURNAL_ENTRY;
    if (normalized === 'journal_entry')
        return VoucherTypes_1.VoucherType.JOURNAL_ENTRY;
    if (normalized === 'receipt')
        return VoucherTypes_1.VoucherType.RECEIPT;
    if (normalized === 'payment')
        return VoucherTypes_1.VoucherType.PAYMENT;
    if (normalized === 'opening' || normalized === 'opening_balance')
        return VoucherTypes_1.VoucherType.OPENING_BALANCE;
    if (normalized === 'fx_revaluation' || normalized === 'revaluation' || normalized === 'fx')
        return VoucherTypes_1.VoucherType.FX_REVALUATION;
    return fallback;
};
const sanitizeSnapshotObject = (value) => {
    const sanitized = sanitizeSnapshotValue(value);
    if (!isPlainObject(sanitized))
        return {};
    return sanitized;
};
const stripSystemManagedSourceFields = (snapshot) => {
    const out = Object.assign({}, (snapshot || {}));
    SYSTEM_MANAGED_SOURCE_FIELDS.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(out, key)) {
            delete out[key];
        }
    });
    return out;
};
const deepMergeObjects = (base, override) => {
    const merged = Object.assign({}, base);
    Object.entries(override || {}).forEach(([key, value]) => {
        const baseValue = merged[key];
        if (isPlainObject(baseValue) && isPlainObject(value)) {
            merged[key] = deepMergeObjects(baseValue, value);
        }
        else {
            merged[key] = value;
        }
    });
    return merged;
};
const removeLegacySourceKeys = (metadata) => {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
        return {};
    const out = {};
    Object.entries(metadata).forEach(([key, entry]) => {
        if (LEGACY_SOURCE_KEYS.has(key))
            return;
        if (entry === undefined)
            return;
        out[key] = entry;
    });
    return out;
};
const buildSourcePayload = (payload, existing) => {
    const previousSnapshot = sanitizeSnapshotObject(existing);
    const explicitSourceSnapshot = sanitizeSnapshotObject(payload === null || payload === void 0 ? void 0 : payload.sourcePayload);
    const fallbackPayloadSnapshot = sanitizeSnapshotObject(payload);
    delete fallbackPayloadSnapshot.sourcePayload;
    if (isPlainObject(fallbackPayloadSnapshot.metadata)) {
        fallbackPayloadSnapshot.metadata = removeLegacySourceKeys(fallbackPayloadSnapshot.metadata);
    }
    const incomingSnapshot = Object.keys(explicitSourceSnapshot).length > 0
        ? explicitSourceSnapshot
        : fallbackPayloadSnapshot;
    const mergedSnapshot = deepMergeObjects(previousSnapshot, incomingSnapshot);
    if (isPlainObject(mergedSnapshot.metadata)) {
        mergedSnapshot.metadata = removeLegacySourceKeys(mergedSnapshot.metadata);
    }
    const cleanedSnapshot = sanitizeSnapshotObject(mergedSnapshot);
    if (Object.keys(cleanedSnapshot).length === 0) {
        return undefined;
    }
    const strippedSnapshot = stripSystemManagedSourceFields(cleanedSnapshot);
    return Object.keys(strippedSnapshot).length > 0 ? strippedSnapshot : undefined;
};
class CreateVoucherUseCase {
    constructor(voucherRepo, accountRepo, settingsRepo, permissionChecker, transactionManager, voucherTypeRepo, policyConfigProvider, ledgerRepo, // Needed for auto-post
    policyRegistry, // Needed for auto-post
    currencyRepo, // NEW: Optional for backward compat in constructor, but required logic
    sequenceRepo) {
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
        this.sequenceRepo = sequenceRepo;
        this.validationService = new VoucherValidationService_1.VoucherValidationService();
    }
    async execute(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
        return this.transactionManager.runTransaction(async (transaction) => {
            var _a, _b;
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
            const resolvedVoucherType = normalizeVoucherTypeCode(payload.type || payload.typeId || payload.baseType || ((_a = payload.metadata) === null || _a === void 0 ? void 0 : _a.type) || ((_b = payload.metadata) === null || _b === void 0 ? void 0 : _b.typeId));
            let voucherNo = payload.voucherNo || '';
            if (autoNumbering && this.sequenceRepo) {
                const prefix = payload.prefix || (resolvedVoucherType || 'V').toString();
                const useYear = (settings === null || settings === void 0 ? void 0 : settings.resetVoucherNumbersAnnually) ? new Date(payload.date || Date.now()).getFullYear() : undefined;
                const numberFormat = payload.numberFormat || undefined;
                voucherNo = await this.sequenceRepo.getNextNumber(companyId, prefix, useYear, numberFormat);
            }
            else if (autoNumbering) {
                voucherNo = `V-${Date.now()}`;
            }
            let lines = [];
            const voucherType = resolvedVoucherType;
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
                // Normalize/validate strategy-produced account refs to persisted UUIDs.
                // Strategies may receive account codes from flexible/cloned forms.
                const accountValidationService = new AccountValidationService_1.AccountValidationService(this.accountRepo);
                lines = await Promise.all(lines.map(async (line) => {
                    const account = await accountValidationService.validateAccountById(companyId, userId, line.accountId, voucherType);
                    if (account.id === line.accountId) {
                        return line;
                    }
                    return new VoucherLineEntity_1.VoucherLineEntity(line.id, account.id, line.side, line.baseAmount, line.baseCurrency, line.amount, line.currency, line.exchangeRate, line.notes, line.costCenterId, line.metadata);
                }));
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
                    l.notes || l.description, l.costCenterId || l.costCenter, l.metadata || {});
                }));
            }
            const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
            const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
            // Build metadata including source tracking fields
            // and capturing any unrecognized top-level fields to avoid data loss
            const coreFields = ['id', 'companyId', 'voucherNo', 'voucherNumber', 'type', 'date', 'description', 'currency', 'baseCurrency', 'exchangeRate', 'lines', 'status', 'metadata', 'reference', 'postingPeriodNo', 'prefix', 'formId', 'sourceModule', 'sourcePayload'];
            const extraMetadata = {};
            Object.keys(payload).forEach(key => {
                if (!coreFields.includes(key) && payload[key] !== undefined && payload[key] !== null) {
                    extraMetadata[key] = payload[key];
                }
            });
            const sourcePayload = buildSourcePayload(payload);
            const cleanedPayloadMetadata = removeLegacySourceKeys(payload.metadata);
            const voucherMetadata = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, extraMetadata), cleanedPayloadMetadata), (payload.sourceModule && { sourceModule: payload.sourceModule })), (payload.formId && { formId: payload.formId })), (payload.prefix && { prefix: payload.prefix }));
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
            userId, new Date(), undefined, // approvedBy
            undefined, // approvedAt
            undefined, // rejectedBy
            undefined, // rejectedAt
            undefined, // rejectionReason
            undefined, // lockedBy
            undefined, // lockedAt
            undefined, // postedBy
            undefined, // postedAt
            undefined, // postingLockPolicy
            undefined, // reversalOfVoucherId
            undefined, // reference
            undefined, // updatedAt
            payload.postingPeriodNo, // Special/Adjustment period override
            sourcePayload || null);
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
                // NEW 3.5: Policy Validation before auto-post
                if (registry) {
                    const policies = await registry.getEnabledPolicies(companyId);
                    if (policies.length > 0) {
                        const context = {
                            companyId: postedVoucher.companyId,
                            voucherId: postedVoucher.id,
                            userId: userId,
                            voucherType: postedVoucher.type,
                            voucherDate: postedVoucher.date,
                            voucherNo: postedVoucher.voucherNo,
                            baseCurrency: postedVoucher.baseCurrency,
                            totalDebit: postedVoucher.totalDebit,
                            totalCredit: postedVoucher.totalCredit,
                            status: postedVoucher.status,
                            isApproved: postedVoucher.isApproved,
                            lines: postedVoucher.lines,
                            metadata: postedVoucher.metadata,
                            postingPeriodNo: postedVoucher.postingPeriodNo
                        };
                        const valService = this.validationService || new VoucherValidationService_1.VoucherValidationService();
                        await valService.validatePolicies(context, policies, 'FAIL_FAST');
                    }
                }
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
    constructor(voucherRepo, accountRepo, permissionChecker, transactionManager, policyConfigProvider, ledgerRepo, policyRegistry, validationService = null) {
        this.voucherRepo = voucherRepo;
        this.accountRepo = accountRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.policyConfigProvider = policyConfigProvider;
        this.ledgerRepo = ledgerRepo;
        this.policyRegistry = policyRegistry;
        this.validationService = validationService;
    }
    async execute(companyId, userId, voucherId, payload) {
        var _a, _b, _c, _d, _e, _f;
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
        const mergedVoucherType = normalizeVoucherTypeCode(payload.type || payload.typeId || payload.baseType || ((_c = payload.metadata) === null || _c === void 0 ? void 0 : _c.type) || ((_d = payload.metadata) === null || _d === void 0 ? void 0 : _d.typeId), voucher.type);
        let lines = [];
        let strategy = null;
        try {
            strategy = VoucherPostingStrategyFactory_1.VoucherPostingStrategyFactory.getStrategy(mergedVoucherType);
        }
        catch (_g) {
            strategy = null;
        }
        if (strategy) {
            const strategyInput = Object.assign(Object.assign({}, payload), { type: mergedVoucherType });
            lines = await strategy.generateLines(strategyInput, companyId, baseCurrency);
            // Normalize/validate strategy-produced account refs to persisted UUIDs.
            lines = await Promise.all(lines.map(async (line, idx) => {
                const account = await accountValidationService.validateAccountById(companyId, userId, line.accountId, mergedVoucherType);
                if (account.id === line.accountId)
                    return line;
                return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, account.id, line.side, line.baseAmount, line.baseCurrency, line.amount, line.currency, line.exchangeRate, line.notes, line.costCenterId, line.metadata);
            }));
        }
        else {
            const rawLines = payload.lines || voucher.lines;
            lines = await Promise.all(rawLines.map(async (l, idx) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
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
                return new VoucherLineEntity_1.VoucherLineEntity(idx + 1, account.id, side, baseAmount, baseCurrency, amount, currency, effectiveExchangeRate, (_o = l.notes) !== null && _o !== void 0 ? _o : originalLine === null || originalLine === void 0 ? void 0 : originalLine.notes, (_q = (_p = l.costCenterId) !== null && _p !== void 0 ? _p : l.costCenter) !== null && _q !== void 0 ? _q : originalLine === null || originalLine === void 0 ? void 0 : originalLine.costCenterId, Object.assign(Object.assign({}, originalLine === null || originalLine === void 0 ? void 0 : originalLine.metadata), l.metadata));
            }));
        }
        const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
        const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
        // Capture any unrecognized top-level fields into metadata to avoid data loss
        const coreFields = ['id', 'companyId', 'voucherNo', 'voucherNumber', 'type', 'date', 'description', 'currency', 'baseCurrency', 'exchangeRate', 'lines', 'status', 'metadata', 'reference', 'postingPeriodNo', 'prefix', 'formId', 'sourceModule', 'sourcePayload'];
        const extraMetadata = {};
        Object.keys(payload).forEach(key => {
            if (!coreFields.includes(key) && payload[key] !== undefined && payload[key] !== null) {
                extraMetadata[key] = payload[key];
            }
        });
        const sourcePayload = buildSourcePayload(payload, voucher.sourcePayload || ((_e = voucher.metadata) === null || _e === void 0 ? void 0 : _e.sourceVoucher));
        const cleanedPayloadMetadata = removeLegacySourceKeys(payload.metadata);
        let updatedVoucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, payload.voucherNo || voucher.voucherNo, mergedVoucherType, payload.date || voucher.date, (_f = payload.description) !== null && _f !== void 0 ? _f : voucher.description, payload.currency || voucher.currency, baseCurrency, payload.exchangeRate || voucher.exchangeRate, lines, totalDebit, totalCredit, 
        // Allow status update only for valid transitions (respects approvalRequired setting)
        this.resolveStatus(voucher.status, payload.status, approvalRequired), Object.assign(Object.assign(Object.assign({}, voucher.metadata), extraMetadata), cleanedPayloadMetadata), voucher.createdBy, voucher.createdAt, voucher.approvedBy, voucher.approvedAt, voucher.rejectedBy, voucher.rejectedAt, voucher.rejectionReason, voucher.lockedBy, voucher.lockedAt, voucher.postedBy, voucher.postedAt, voucher.postingLockPolicy, voucher.reversalOfVoucherId, payload.reference || voucher.reference, new Date(), payload.postingPeriodNo !== undefined ? payload.postingPeriodNo : voucher.postingPeriodNo, sourcePayload || voucher.sourcePayload || null);
        // NEW Step: Policy Validation if auto-approving
        // If the update transitions the voucher to APPROVED, check the date!
        if (updatedVoucher.isApproved && this.ledgerRepo && !voucher.isApproved) {
            // This check is mainly for Flexible Mode auto-approval during update
            // If the voucher was already approved, we rely on the state guard in assertCanEdit
        }
        // Actually, if status is moving to APPROVED, we check policies.
        if (updatedVoucher.isApproved && !voucher.isApproved && this.policyRegistry) {
            const policies = await this.policyRegistry.getEnabledPolicies(companyId);
            if (policies.length > 0) {
                const context = {
                    companyId: updatedVoucher.companyId,
                    voucherId: updatedVoucher.id,
                    userId: userId,
                    voucherType: updatedVoucher.type,
                    voucherDate: updatedVoucher.date,
                    voucherNo: updatedVoucher.voucherNo,
                    baseCurrency: updatedVoucher.baseCurrency,
                    totalDebit: updatedVoucher.totalDebit,
                    totalCredit: updatedVoucher.totalCredit,
                    status: updatedVoucher.status,
                    isApproved: updatedVoucher.isApproved,
                    lines: updatedVoucher.lines,
                    metadata: updatedVoucher.metadata,
                    postingPeriodNo: updatedVoucher.postingPeriodNo
                };
                const valService = this.validationService || new VoucherValidationService_1.VoucherValidationService();
                await valService.validatePolicies(context, policies, 'FAIL_FAST');
            }
        }
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
    constructor(voucherRepo, permissionChecker, policyRegistry, // AccountingPolicyRegistry
    validationService = null // VoucherValidationService
    ) {
        this.voucherRepo = voucherRepo;
        this.permissionChecker = permissionChecker;
        this.policyRegistry = policyRegistry;
        this.validationService = validationService;
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
        // NEW 2.5: Policy Validation Gate
        // If this satisfies all gates and will move to APPROVED, check if the period is locked!
        if (isFullySatisfied && this.policyRegistry && this.validationService) {
            const policies = await this.policyRegistry.getEnabledPolicies(companyId);
            if (policies.length > 0) {
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
                    status: VoucherTypes_1.VoucherStatus.APPROVED,
                    isApproved: true,
                    lines: voucher.lines,
                    metadata: voucher.metadata,
                    postingPeriodNo: voucher.postingPeriodNo
                };
                await this.validationService.validatePolicies(context, policies, 'FAIL_FAST');
            }
        }
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
                            metadata: voucher.metadata,
                            postingPeriodNo: voucher.postingPeriodNo
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
        const cancelledVoucher = voucher.cancel(userId, new Date(), 'Deleted by user', voucher.isPosted);
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
    async execute(companyId, userId, limit, filters, offset) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
        return this.voucherRepo.findByCompany(companyId, limit, filters, offset);
    }
}
exports.ListVouchersUseCase = ListVouchersUseCase;
//# sourceMappingURL=VoucherUseCases.js.map