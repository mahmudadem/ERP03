import { v4 as uuidv4 } from 'uuid';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { PostVoucherUseCase, CreateVoucherUseCase } from './VoucherUseCases';
import { 
  CorrectionMode, 
  CorrectionOptions, 
  CorrectionResult,
  ReplacementPayload 
} from '../../../domain/accounting/types/CorrectionTypes';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { normalizeAccountingDate } from '../../../domain/accounting/utils/DateNormalization';

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
export class ReverseAndReplaceVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private policyRegistry?: any, // AccountingPolicyRegistry
    private accountRepo?: any, // IAccountRepository
    private settingsRepo?: any // ICompanyModuleSettingsRepository
  ) {}

  async execute(
    companyId: string,
    userId: string,
    originalVoucherId: string,
    correctionMode: CorrectionMode,
    replacePayload?: ReplacementPayload,
    options: CorrectionOptions = {}
  ): Promise<CorrectionResult> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.correct');

    return this.transactionManager.runTransaction(async (transaction) => {
      // Step 1: Load and validate original voucher
      const originalVoucher = await this.voucherRepo.findById(companyId, originalVoucherId);
      if (!originalVoucher) {
        throw new Error('Original voucher not found');
      }

      if (originalVoucher.status !== VoucherStatus.POSTED) {
        throw new Error(`Cannot correct voucher in status: ${originalVoucher.status}. Only POSTED vouchers can be corrected.`);
      }

      // Step 2: Check idempotency - has this voucher already been reversed?
      const existingReversal = await this.findExistingReversal(companyId, originalVoucherId);
      if (existingReversal) {
        // Already reversed - return existing correction
        const existingReplacement = await this.findExistingReplacement(companyId, originalVoucherId);
        
        return {
          reverseVoucherId: existingReversal.id,
          replaceVoucherId: existingReplacement?.id,
          correctionGroupId: existingReversal.correctionGroupId || 'unknown',
          summary: {
            reversalPosted: existingReversal.isPosted,
            replacementCreated: !!existingReplacement,
            replacementPosted: existingReplacement?.isPosted || false
          }
        };
      }

      // Step 3: Generate correction group ID
      const correctionGroupId = uuidv4();

      // Step 4: Determine reversal date
      // DEFAULT: Use original voucher date (maintains period alignment)
      // OVERRIDE: Use today if explicitly requested
      let reversalDate: string;
      if (options.reversalDate === 'today') {
        reversalDate = normalizeAccountingDate(new Date());
      } else if (options.reversalDate && options.reversalDate !== 'today') {
        reversalDate = normalizeAccountingDate(options.reversalDate);
      } else {
        // Default: use original voucher date
        reversalDate = originalVoucher.date;
      }

      // Step 5: Create reversal voucher
      const reversalVoucher = originalVoucher.createReversal(
        reversalDate,
        correctionGroupId,
        userId, // Added userId
        options.reason
      );

      // Save reversal as DRAFT first
      const savedReversal = await this.voucherRepo.save(reversalVoucher);

      // Step 5: Post reversal via PostVoucherUseCase (policies apply)
      const postUseCase = new PostVoucherUseCase(
        this.voucherRepo,
        this.ledgerRepo,
        this.permissionChecker,
        this.transactionManager,
        this.policyRegistry
      );

      try {
        await postUseCase.execute(companyId, userId, savedReversal.id);
      } catch (error: any) {
        // Policy or validation blocked reversal
        // Clean up draft reversal and propagate error
        throw new Error(`Reversal blocked: ${error.message}`);
      }

      let replacementVoucherId: string | undefined;
      let replacementPosted = false;

      // Step 6: Create replacement voucher if requested
      if (correctionMode === CorrectionMode.REVERSE_AND_REPLACE) {
        if (!replacePayload) {
          throw new Error('Replacement payload required for REVERSE_AND_REPLACE mode');
        }

        const createUseCase = new CreateVoucherUseCase(
          this.voucherRepo,
          this.accountRepo,
          this.settingsRepo,
          this.permissionChecker,
          this.transactionManager,
          (this as any).voucherTypeRepo || null // Fixed: should ideally be passed in constructor
        );

        // Build replacement voucher payload
        const replacementPayloadWithMetadata = {
          ...replacePayload,
          type: originalVoucher.type,
          metadata: {
            ...replacePayload.metadata,
            replacesVoucherId: originalVoucherId,
            correctionGroupId,
            correctionReason: options.reason
          }
        };

        const replacement = await createUseCase.execute(
          companyId,
          userId,
          replacementPayloadWithMetadata
        );

        replacementVoucherId = replacement.id;

        // Optionally auto-post replacement if requested AND policies allow
        if (options.replaceStartsAsDraft === false) {
          try {
            await postUseCase.execute(companyId, userId, replacement.id);
            replacementPosted = true;
          } catch (error: any) {
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
  private async findExistingReversal(companyId: string, originalVoucherId: string) {
    // Query for vouchers with reversalOfVoucherId = originalVoucherId
    const vouchers = await this.voucherRepo.findByCompany(companyId);
    return vouchers.find(v => v.metadata.reversalOfVoucherId === originalVoucherId);
  }

  /**
   * Find existing replacement for a voucher
   */
  private async findExistingReplacement(companyId: string, originalVoucherId: string) {
    const vouchers = await this.voucherRepo.findByCompany(companyId);
    return vouchers.find(v => v.metadata.replacesVoucherId === originalVoucherId);
  }
}
