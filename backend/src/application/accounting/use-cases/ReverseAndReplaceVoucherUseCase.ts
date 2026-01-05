import { v4 as uuidv4 } from 'uuid';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { CreateVoucherUseCase } from './VoucherUseCases';
import { 
  CorrectionMode, 
  CorrectionOptions, 
  CorrectionResult,
  ReplacementPayload 
} from '../../../domain/accounting/types/CorrectionTypes';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { normalizeAccountingDate } from '../../../domain/accounting/utils/DateNormalization';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

import { SubmitVoucherUseCase } from './SubmitVoucherUseCase';
import { ApprovalPolicyService } from '../../../domain/accounting/policies/ApprovalPolicyService';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';

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
    private settingsRepo?: any, // ICompanyModuleSettingsRepository
    private policyConfigProvider?: IAccountingPolicyConfigProvider
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

      // Step 2: Validation - Only POSTED vouchers can be corrected (Reversed)
      if (!originalVoucher.isPosted) {
        throw new Error(`Cannot reverse voucher in status "${originalVoucher.status}". Only POSTED vouchers (those with financial effect) can be reversed.`);
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

      // Step 5: Fetch ACTUAL ledger entries (Audit Source of Truth)
      const ledgerLines = await this.ledgerRepo.getGeneralLedger(companyId, { voucherId: originalVoucherId });
      
      // V2 FAIL-FAST: Ensure ledger entries exist before creating reversal
      if (!ledgerLines || ledgerLines.length === 0) {
        throw new BusinessError(
          ErrorCode.LEDGER_NOT_FOUND_FOR_POSTED_VOUCHER,
          'Cannot reverse: no posted ledger lines found for this posted voucher.',
          { voucherId: originalVoucherId, httpStatus: 409 }
        );
      }

      // Step 6: Create reversal voucher using ledger entries
      const reversalVoucherId = uuidv4(); // Generate ID for persistence
      const reversalVoucher = originalVoucher.createReversal(
        reversalVoucherId,
        reversalDate,
        correctionGroupId,
        userId,
        ledgerLines,
        options.reason
      );

      // Save reversal as DRAFT first
      const savedReversal = await this.voucherRepo.save(reversalVoucher);
      
      // DEEP INTEGRATION: Submit reversal for approval (Governance: Formal Gates)
      // Using SubmitVoucherUseCase to evaluate policies, custodians, and managers
      if (!this.policyConfigProvider) {
        throw new Error('policyConfigProvider required for strict reversal approval');
      }

      const getAccountMetadata = async (cid: string, accountIds: string[]) => {
        const accounts = await Promise.all(
          accountIds.map(id => this.accountRepo?.getById(cid, id))
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
        this.voucherRepo,
        this.policyConfigProvider,
        new ApprovalPolicyService(),
        getAccountMetadata
      );

      const pendingReversal = await submitUseCase.execute(companyId, savedReversal.id, userId);

      // NOTE: Reversal is now PENDING (or APPROVED if Mode A)
      // If APPROVED, it will NOT auto-post here because this transaction is meant to create correction entries.
      // The user/system should post it via the normal verify/post flow.

      let replacementVoucherId: string | undefined;

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
          (this as any).voucherTypeRepo || null
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
   * Find existing reversal for a voucher (idempotency check)
   */
  private async findExistingReversal(companyId: string, originalVoucherId: string) {
    // Structural check using the new field
    const vouchers = await this.voucherRepo.findByCompany(companyId);
    return vouchers.find(v => v.reversalOfVoucherId === originalVoucherId);
  }

  /**
   * Find existing replacement for a voucher
   */
  private async findExistingReplacement(companyId: string, originalVoucherId: string) {
    const vouchers = await this.voucherRepo.findByCompany(companyId);
    return vouchers.find(v => v.metadata.replacesVoucherId === originalVoucherId);
  }
}
