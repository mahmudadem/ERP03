"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseAndReplaceVoucherUseCase = void 0;
const uuid_1 = require("uuid");
const VoucherUseCases_1 = require("./VoucherUseCases");
const CorrectionTypes_1 = require("../../../domain/accounting/types/CorrectionTypes");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const DateNormalization_1 = require("../../../domain/accounting/utils/DateNormalization");
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
    settingsRepo // ICompanyModuleSettingsRepository
    ) {
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.permissionChecker = permissionChecker;
        this.transactionManager = transactionManager;
        this.policyRegistry = policyRegistry;
        this.accountRepo = accountRepo;
        this.settingsRepo = settingsRepo;
    }
    async execute(companyId, userId, originalVoucherId, correctionMode, replacePayload, options = {}) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.correct');
        return this.transactionManager.runTransaction(async (transaction) => {
            // Step 1: Load and validate original voucher
            const originalVoucher = await this.voucherRepo.findById(companyId, originalVoucherId);
            if (!originalVoucher) {
                throw new Error('Original voucher not found');
            }
            if (originalVoucher.status !== VoucherTypes_1.VoucherStatus.POSTED && originalVoucher.status !== VoucherTypes_1.VoucherStatus.APPROVED) {
                throw new Error(`Cannot correct voucher in status: ${originalVoucher.status}. Only POSTED or APPROVED vouchers can be corrected.`);
            }
            // Step 2: Check idempotency - has this voucher already been reversed?
            const existingReversal = await this.findExistingReversal(companyId, originalVoucherId);
            if (existingReversal) {
                // Already reversed - return existing correction
                const existingReplacement = await this.findExistingReplacement(companyId, originalVoucherId);
                return {
                    reverseVoucherId: existingReversal.id,
                    replaceVoucherId: existingReplacement === null || existingReplacement === void 0 ? void 0 : existingReplacement.id,
                    correctionGroupId: existingReversal.correctionGroupId || 'unknown',
                    summary: {
                        reversalPosted: existingReversal.isPosted,
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
            // Step 5: Create reversal voucher
            const reversalVoucher = originalVoucher.createReversal(reversalDate, correctionGroupId, userId, // Added userId
            options.reason);
            // Save reversal as DRAFT first
            const savedReversal = await this.voucherRepo.save(reversalVoucher);
            // Step 5: Post reversal via PostVoucherUseCase (policies apply)
            const postUseCase = new VoucherUseCases_1.PostVoucherUseCase(this.voucherRepo, this.ledgerRepo, this.permissionChecker, this.transactionManager, this.policyRegistry);
            try {
                await postUseCase.execute(companyId, userId, savedReversal.id);
            }
            catch (error) {
                // Policy or validation blocked reversal
                // Clean up draft reversal and propagate error
                throw new Error(`Reversal blocked: ${error.message}`);
            }
            let replacementVoucherId;
            let replacementPosted = false;
            // Step 6: Create replacement voucher if requested
            if (correctionMode === CorrectionTypes_1.CorrectionMode.REVERSE_AND_REPLACE) {
                if (!replacePayload) {
                    throw new Error('Replacement payload required for REVERSE_AND_REPLACE mode');
                }
                const createUseCase = new VoucherUseCases_1.CreateVoucherUseCase(this.voucherRepo, this.accountRepo, this.settingsRepo, this.permissionChecker, this.transactionManager, this.voucherTypeRepo || null // Fixed: should ideally be passed in constructor
                );
                // Build replacement voucher payload
                const replacementPayloadWithMetadata = Object.assign(Object.assign({}, replacePayload), { type: originalVoucher.type, metadata: Object.assign(Object.assign({}, replacePayload.metadata), { replacesVoucherId: originalVoucherId, correctionGroupId, correctionReason: options.reason }) });
                const replacement = await createUseCase.execute(companyId, userId, replacementPayloadWithMetadata);
                replacementVoucherId = replacement.id;
                // Optionally auto-post replacement if requested AND policies allow
                if (options.replaceStartsAsDraft === false) {
                    try {
                        await postUseCase.execute(companyId, userId, replacement.id);
                        replacementPosted = true;
                    }
                    catch (error) {
                        // Policy blocked - replacement stays as DRAFT
                        // This is acceptable, user can post manually later
                    }
                }
            }
            return {
                reverseVoucherId: savedReversal.id,
                replaceVoucherId: replacementVoucherId,
                correctionGroupId,
                summary: {
                    reversalPosted: true,
                    replacementCreated: !!replacementVoucherId,
                    replacementPosted
                }
            };
        });
    }
    /**
     * Find existing reversal for a voucher (idempotency check)
     */
    async findExistingReversal(companyId, originalVoucherId) {
        // Query for vouchers with reversalOfVoucherId = originalVoucherId
        const vouchers = await this.voucherRepo.findByCompany(companyId);
        return vouchers.find(v => v.metadata.reversalOfVoucherId === originalVoucherId);
    }
    /**
     * Find existing replacement for a voucher
     */
    async findExistingReplacement(companyId, originalVoucherId) {
        const vouchers = await this.voucherRepo.findByCompany(companyId);
        return vouchers.find(v => v.metadata.replacesVoucherId === originalVoucherId);
    }
}
exports.ReverseAndReplaceVoucherUseCase = ReverseAndReplaceVoucherUseCase;
//# sourceMappingURL=ReverseAndReplaceVoucherUseCase.js.map