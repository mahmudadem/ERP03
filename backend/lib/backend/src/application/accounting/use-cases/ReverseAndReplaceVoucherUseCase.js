"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseAndReplaceVoucherUseCase = void 0;
const uuid_1 = require("uuid");
const VoucherUseCases_1 = require("./VoucherUseCases");
const CorrectionTypes_1 = require("../../../domain/accounting/types/CorrectionTypes");
const DateNormalization_1 = require("../../../domain/accounting/utils/DateNormalization");
const AppError_1 = require("../../../errors/AppError");
const ErrorCodes_1 = require("../../../errors/ErrorCodes");
const SubmitVoucherUseCase_1 = require("./SubmitVoucherUseCase");
const ApprovalPolicyService_1 = require("../../../domain/accounting/policies/ApprovalPolicyService");
/**
 * ReverseAndReplaceVoucherUseCase
 *
 * Implements operational correction flow for posted vouchers.
 *
 * Key principles:
 * - Original POSTED voucher is never modified
 * - Corrections represented as new vouchers
 * - All corrections flow through PostVoucherUseCase (single posting point)
 * - Full policy validation applies to reversals
 * - Idempotency prevents double-reversals
 *
 * Modes:
 * - REVERSE_ONLY: Creates reversal voucher that negates original
 * - REVERSE_AND_REPLACE: Creates reversal + replacement voucher
 */
class ReverseAndReplaceVoucherUseCase {
    constructor(voucherRepo, ledgerRepo, permissionChecker, transactionManager, policyRegistry, // AccountingPolicyRegistry
    accountRepo, // IAccountRepository
    settingsRepo, // ICompanyModuleSettingsRepository
    policyConfigProvider) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.policyRegistry = policyRegistry;
        this.accountRepo = accountRepo;
        this.settingsRepo = settingsRepo;
        this.policyConfigProvider = policyConfigProvider;
    }
    async execute(companyId, userId, originalVoucherId, correctionMode, replacePayload, options = {}) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.correct');
        return this.transactionManager.runTransaction(async (transaction) => {
            // Step 1: Load and validate original voucher
            const originalVoucher = await this.voucherRepo.findById(companyId, originalVoucherId);
            if (!originalVoucher) {
                throw new Error('Original voucher not found');
            }
            // Step 2: Validation - Only POSTED vouchers can be corrected (Reversed)
            if (!originalVoucher.isPosted) {
                throw new Error(`Cannot reverse voucher in status "${originalVoucher.status}". Only POSTED vouchers (those with financial effect) can be reversed.`);
            }
            // Step 2: Check idempotency - has this voucher already been reversed?
            // Use the new targeted query for reversal check
            const existingReversal = await this.voucherRepo.findByReversalOfVoucherId(companyId, originalVoucherId);
            if (existingReversal) {
                // Already reversed - return existing correction status
                const existingReplacement = await this.findExistingReplacement(companyId, originalVoucherId);
                return {
                    reverseVoucherId: existingReversal.id,
                    replaceVoucherId: existingReplacement === null || existingReplacement === void 0 ? void 0 : existingReplacement.id,
                    correctionGroupId: existingReversal.correctionGroupId || 'unknown',
                    summary: {
                        reversalPosted: existingReversal.isPosted,
                        reversalStatus: existingReversal.status,
                        replacementCreated: !!existingReplacement,
                        replacementPosted: (existingReplacement === null || existingReplacement === void 0 ? void 0 : existingReplacement.isPosted) || false
                    }
                };
            }
            // Step 3: Generate correction group ID
            const correctionGroupId = (0, uuid_1.v4)();
            // Step 4: Determine reversal date
            // DEFAULT: Use original voucher date (maintains period alignment)
            // OVERRIDE: Use today if explicitly requested
            let reversalDate;
            if (options.reversalDate === 'today') {
                reversalDate = (0, DateNormalization_1.normalizeAccountingDate)(new Date());
            }
            else if (options.reversalDate && options.reversalDate !== 'today') {
                reversalDate = (0, DateNormalization_1.normalizeAccountingDate)(options.reversalDate);
            }
            else {
                // Default: use original voucher date
                reversalDate = originalVoucher.date;
            }
            // Step 5: Fetch ACTUAL ledger entries (Audit Source of Truth)
            const ledgerLines = await this.ledgerRepo.getGeneralLedger(companyId, { voucherId: originalVoucherId });
            // V2 FAIL-FAST: Ensure ledger entries exist before creating reversal
            if (!ledgerLines || ledgerLines.length === 0) {
                throw new AppError_1.BusinessError(ErrorCodes_1.ErrorCode.LEDGER_NOT_FOUND_FOR_POSTED_VOUCHER, 'Cannot reverse: no posted ledger lines found for this posted voucher.', { voucherId: originalVoucherId, httpStatus: 409 });
            }
            // Step 6: Create reversal voucher using ledger entries
            const reversalVoucherId = (0, uuid_1.v4)(); // Generate ID for persistence
            const reversalVoucher = originalVoucher.createReversal(reversalVoucherId, reversalDate, correctionGroupId, userId, ledgerLines, options.reason);
            // Save reversal as DRAFT first
            const savedReversal = await this.voucherRepo.save(reversalVoucher);
            // PERSIST LINKAGE: Link the reversal attempt
            // This ensures the original record knows a reversal is in progress
            const reversedOriginal = originalVoucher.linkReversal(reversalVoucherId);
            await this.voucherRepo.save(reversedOriginal);
            // DEEP INTEGRATION: Submit reversal for approval (Governance: Formal Gates)
            // Using SubmitVoucherUseCase to evaluate policies, custodians, and managers
            if (!this.policyConfigProvider) {
                throw new Error('policyConfigProvider required for strict reversal approval');
            }
            const getAccountMetadata = async (cid, accountIds) => {
                const accounts = await Promise.all(accountIds.map(id => { var _a; return (_a = this.accountRepo) === null || _a === void 0 ? void 0 : _a.getById(cid, id); }));
                return accounts
                    .filter(acc => acc !== null)
                    .map(acc => ({
                    accountId: acc.id,
                    requiresApproval: acc.requiresApproval || false,
                    requiresCustodyConfirmation: acc.requiresCustodyConfirmation || false,
                    custodianUserId: acc.custodianUserId || undefined
                }));
            };
            const submitUseCase = new SubmitVoucherUseCase_1.SubmitVoucherUseCase(this.voucherRepo, this.policyConfigProvider, new ApprovalPolicyService_1.ApprovalPolicyService(), getAccountMetadata);
            const pendingReversal = await submitUseCase.execute(companyId, savedReversal.id, userId);
            // NOTE: Reversal is now PENDING (or APPROVED if Mode A)
            // If APPROVED, it will NOT auto-post here because this transaction is meant to create correction entries.
            // The user/system should post it via the normal verify/post flow.
            let replacementVoucherId;
            // Step 6: Create replacement voucher if requested
            if (correctionMode === CorrectionTypes_1.CorrectionMode.REVERSE_AND_REPLACE) {
                if (!replacePayload) {
                    throw new Error('Replacement payload required for REVERSE_AND_REPLACE mode');
                }
                const createUseCase = new VoucherUseCases_1.CreateVoucherUseCase(this.voucherRepo, this.accountRepo, this.settingsRepo, this.permissionChecker, this.transactionManager, this.voucherTypeRepo || null);
                // Build replacement voucher payload
                const replacementPayloadWithMetadata = Object.assign(Object.assign({}, replacePayload), { type: originalVoucher.type, metadata: Object.assign(Object.assign({}, replacePayload.metadata), { replacesVoucherId: originalVoucherId, correctionGroupId, correctionReason: options.reason }) });
                const replacement = await createUseCase.execute(companyId, userId, replacementPayloadWithMetadata);
                replacementVoucherId = replacement.id;
                // Replacement also starts as DRAFT - can be submitted for approval separately
            }
            return {
                reverseVoucherId: pendingReversal.id,
                replaceVoucherId: replacementVoucherId,
                correctionGroupId,
                summary: {
                    reversalPosted: pendingReversal.isPosted,
                    reversalStatus: pendingReversal.status,
                    replacementCreated: !!replacementVoucherId,
                    replacementPosted: false
                }
            };
        });
    }
    /**
     * Find existing replacement for a voucher
     */
    async findExistingReplacement(companyId, originalVoucherId) {
        // Replacement is identified by metadata.replacesVoucherId
        // Since this is less frequent, we keep the collection find for now, 
        // but in a real high-scale system, this should also be a targeted repo method.
        const vouchers = await this.voucherRepo.findByCompany(companyId);
        return vouchers.find(v => { var _a; return ((_a = v.metadata) === null || _a === void 0 ? void 0 : _a.replacesVoucherId) === originalVoucherId; });
    }
}
exports.ReverseAndReplaceVoucherUseCase = ReverseAndReplaceVoucherUseCase;
//# sourceMappingURL=ReverseAndReplaceVoucherUseCase.js.map