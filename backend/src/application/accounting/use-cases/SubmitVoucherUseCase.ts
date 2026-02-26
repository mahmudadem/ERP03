import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { ApprovalPolicyService, ApprovalGateResult, AccountApprovalMetadata } from '../../../domain/accounting/policies/ApprovalPolicyService';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { NotificationService } from '../../system/services/NotificationService';

/**
 * Submit Voucher for Approval Use Case
 * 
 * Approval Policy V1 Compliant
 * 
 * This implements the submission logic:
 * - DRAFT → PENDING (if gates are required)
 * - DRAFT → APPROVED (if no gates required, Mode A behavior)
 * 
 * At submit time:
 * 1. Evaluate gates based on touched accounts
 * 2. Capture custodian snapshot (frozen at submit)
 * 3. Transition to PENDING or APPROVED
 * 4. Dispatch notifications to approvers/custodians
 * 
 * HARD POLICY: Gate requirements are frozen at submit time.
 */
export class SubmitVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly policyConfigProvider: IAccountingPolicyConfigProvider,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly getAccountMetadata: (companyId: string, accountIds: string[]) => Promise<AccountApprovalMetadata[]>,
    private readonly notificationService?: NotificationService,
    private readonly getApproverUserIds?: (companyId: string) => Promise<string[]>,
    private readonly policyRegistry?: any, // AccountingPolicyRegistry
    private readonly validationService: any = null // VoucherValidationService
  ) {}

  /**
   * Submit a voucher for approval
   * 
   * @param companyId Company ID
   * @param voucherId Voucher ID to submit
   * @param submitterId User ID submitting
   * @returns Updated voucher entity
   * @throws Error if voucher not found or cannot be submitted
   */
  async execute(
    companyId: string,
    voucherId: string,
    submitterId: string
  ): Promise<VoucherEntity> {
    // Step 1: Load voucher
    const voucher = await this.voucherRepository.findById(companyId, voucherId);
    
    if (!voucher) {
      throw new Error(`Voucher not found: ${voucherId}`);
    }

    // Step 2: Validate can submit (only DRAFT or REJECTED status)
    // IDEMPOTENCY FIX: If voucher is already APPROVED, assume it was auto-processed (Flexible Mode)
    // and return it immediately instead of throwing error.
    if (voucher.status === VoucherStatus.APPROVED) {
      return voucher;
    }

    if (voucher.status !== VoucherStatus.DRAFT && voucher.status !== VoucherStatus.REJECTED) {
      throw new Error(
        `Cannot submit voucher in status "${voucher.status}". ` +
        `Voucher must be in DRAFT or REJECTED status.`
      );
    }

    // Step 3: Load policy config
    const policyConfig = await this.policyConfigProvider.getConfig(companyId);
    
    // Step 4: Get account metadata for all touched accounts
    const accountIds = [...new Set(voucher.lines.map(line => line.accountId))];
    const accountMetadata = await this.getAccountMetadata(companyId, accountIds);
    
    // Step 5: Build Smart CC context with line-level debit/credit info
    const smartCCContext = {
      creatorUserId: submitterId,
      voucherTotal: voucher.totalDebit || 0,
      lines: voucher.lines.map(line => ({
        accountId: line.accountId,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0
      })),
      isReversal: !!voucher.reversalOfVoucherId
    };
    
    // Step 6: Evaluate gates using Smart CC logic
    const gateResult = this.approvalPolicyService.evaluateSmartGates(
      policyConfig,
      accountMetadata,
      smartCCContext
    );
    
    // Step 6.5: Check for missing custodians (if blocking enabled)
    if (gateResult.missingCustodianAccounts && gateResult.missingCustodianAccounts.length > 0) {
      throw new Error(
        `Cannot submit: The following accounts require custody confirmation but have no custodian assigned: ` +
        gateResult.missingCustodianAccounts.join(', ')
      );
    }

    // NEW Step 6.7: Policy Validation Gate
    // CRITICAL: We check period lock even BEFORE submission. 
    // This prevents vouchers from being trapped in APPROVED status in a locked period.
    if (this.policyRegistry && this.validationService) {
      const targetStatus = this.approvalPolicyService.shouldAutoApprove(gateResult) ? VoucherStatus.APPROVED : VoucherStatus.PENDING;
      
      // We check policies if:
      // A) Voucher will be auto-approved (immediate posting risk)
      // B) Always check during submission to prevent locking them later
      const policies = await this.policyRegistry.getEnabledPolicies(companyId);
      // Filter out 'approval-required' policy for submission
      // This policy blocks non-approved vouchers, but submission is what MOVES them towards approval.
      const filteredPolicies = policies.filter(p => p.id !== 'approval-required');
      
      if (filteredPolicies.length > 0) {
        const context = {
          companyId: voucher.companyId,
          voucherId: voucher.id,
          userId: submitterId,
          voucherType: voucher.type,
          voucherDate: voucher.date,
          voucherNo: voucher.voucherNo,
          baseCurrency: voucher.baseCurrency,
          totalDebit: voucher.totalDebit,
          totalCredit: voucher.totalCredit,
          status: targetStatus,
          isApproved: targetStatus === VoucherStatus.APPROVED,
          lines: voucher.lines,
          metadata: voucher.metadata,
          postingPeriodNo: voucher.postingPeriodNo
        };
        
        // Mode: FAIL_FAST for submission
        await this.validationService.validatePolicies(context, filteredPolicies, 'FAIL_FAST');
      }
    }
    
    // Step 7: Create updated voucher with gate requirements frozen in metadata
    const submittedVoucher = this.createSubmittedVoucher(voucher, submitterId, gateResult);
    
    // Step 8: Save
    const savedVoucher = await this.voucherRepository.save(submittedVoucher);
    
    // Step 9: Dispatch notifications (non-blocking)
    this.dispatchNotifications(companyId, savedVoucher, gateResult).catch(() => {
      // Log error but don't fail the submission
      console.error('[SubmitVoucherUseCase] Notification dispatch failed');
    });
    
    return savedVoucher;
  }

  /**
   * Dispatch notifications to approvers and custodians
   */
  private async dispatchNotifications(
    companyId: string,
    voucher: VoucherEntity,
    gateResult: ApprovalGateResult
  ): Promise<void> {
    if (!this.notificationService) return;

    const voucherNo = voucher.voucherNo || voucher.id.slice(0, 8);

    // Notify approvers if FA is required
    if (gateResult.financialApprovalRequired && this.getApproverUserIds) {
      try {
        const approverIds = await this.getApproverUserIds(companyId);
        if (approverIds.length > 0) {
          await this.notificationService.notifyVoucherAction(
            companyId,
            approverIds,
            voucherNo,
            voucher.id,
            'APPROVAL'
          );
        } else {
          console.warn('[SubmitVoucherUseCase] FA required but no approver users were resolved');
        }
      } catch (e) {
        console.error('[SubmitVoucherUseCase] Failed to notify approvers:', e);
      }
    }

    // Notify custodians if CC is required
    if (gateResult.custodyConfirmationRequired && gateResult.requiredCustodians.length > 0) {
      try {
        await this.notificationService.notifyVoucherAction(
          companyId,
          gateResult.requiredCustodians,
          voucherNo,
          voucher.id,
          'CUSTODY'
        );
      } catch (e) {
        console.error('[SubmitVoucherUseCase] Failed to notify custodians:', e);
      }
    }

    // Notify releasing-party custodians (awareness only, no action required)
    if (gateResult.notifyOnlyCustodians && gateResult.notifyOnlyCustodians.length > 0) {
      try {
        await this.notificationService.notifyVoucherAction(
          companyId,
          gateResult.notifyOnlyCustodians,
          voucherNo,
          voucher.id,
          'INFO' // Informational notification only
        );
      } catch (e) {
        console.error('[SubmitVoucherUseCase] Failed to notify releasing parties:', e);
      }
    }
  }
  
  private createSubmittedVoucher(
    voucher: VoucherEntity,
    submitterId: string,
    gateResult: ApprovalGateResult
  ): VoucherEntity {
    const now = new Date();
    
    // Determine target status
    const shouldAutoApprove = this.approvalPolicyService.shouldAutoApprove(gateResult);
    const targetStatus = shouldAutoApprove ? VoucherStatus.APPROVED : VoucherStatus.PENDING;
    
    // Build approval tracking metadata
    const approvalMetadata = {
      ...voucher.metadata,
      // Gate requirements (frozen at submit)
      financialApprovalRequired: gateResult.financialApprovalRequired,
      custodyConfirmationRequired: gateResult.custodyConfirmationRequired,
      operatingMode: gateResult.mode,
      
      // Gate satisfaction tracking
      pendingFinancialApproval: gateResult.financialApprovalRequired,
      pendingCustodyConfirmations: [...gateResult.requiredCustodians],
      
      // Submission audit
      submittedBy: submitterId,
      submittedAt: now.toISOString(),
      
      // Confirmation records (empty initially)
      financialApproval: null,
      custodyConfirmations: []
    };
    
    // Create new entity with updated status and metadata
    // V1 CRITICAL: postedAt/postedBy are NOT set here. 
    // They must ONLY be set AFTER ledger write succeeds (by PostVoucherUseCase).
    return new VoucherEntity(
      voucher.id,
      voucher.companyId,
      voucher.voucherNo,
      voucher.type,
      voucher.date,
      voucher.description,
      voucher.currency,
      voucher.baseCurrency,
      voucher.exchangeRate,
      voucher.lines,
      voucher.totalDebit,
      voucher.totalCredit,
      targetStatus,
      approvalMetadata,
      voucher.createdBy,
      voucher.createdAt,
      shouldAutoApprove ? submitterId : undefined,  // approvedBy
      shouldAutoApprove ? now : undefined,          // approvedAt
      undefined, // rejectedBy
      undefined, // rejectedAt
      undefined, // rejectionReason
      voucher.lockedBy,
      voucher.lockedAt,
      undefined,  // postedBy - V1: NEVER set here, only after ledger write
      undefined,  // postedAt - V1: NEVER set here, only after ledger write
      voucher.postingLockPolicy, // postingLockPolicy (preserve existing)
      voucher.reversalOfVoucherId, // reversalOfVoucherId (preserve existing)
      voucher.reference,
      now, // updatedAt
      voucher.postingPeriodNo
    );
  }
}
