import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { ApprovalPolicyService, ApprovalGateResult, AccountApprovalMetadata } from '../../../domain/accounting/policies/ApprovalPolicyService';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';

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
 * 
 * HARD POLICY: Gate requirements are frozen at submit time.
 */
export class SubmitVoucherUseCase {
  constructor(
    private readonly voucherRepository: IVoucherRepository,
    private readonly policyConfigProvider: IAccountingPolicyConfigProvider,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly getAccountMetadata: (companyId: string, accountIds: string[]) => Promise<AccountApprovalMetadata[]>
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
    
    // Step 5: Evaluate gates
    const gateResult = this.approvalPolicyService.evaluateGates(policyConfig, accountMetadata);
    
    // Step 6: Create updated voucher with gate requirements frozen in metadata
    const submittedVoucher = this.createSubmittedVoucher(voucher, submitterId, gateResult);
    
    // Step 7: Save
    const savedVoucher = await this.voucherRepository.save(submittedVoucher);
    
    return savedVoucher;
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
      now // updatedAt
    );
  }
}
