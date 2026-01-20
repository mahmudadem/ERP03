import { randomUUID } from 'crypto';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IAccountRepository, ILedgerRepository } from '../../../repository/interfaces/accounting';
import { ICompanyModuleSettingsRepository } from '../../../repository/interfaces/system/ICompanyModuleSettingsRepository';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { VoucherPostingStrategyFactory } from '../../../domain/accounting/factories/VoucherPostingStrategyFactory';
import { PostingFieldExtractor } from '../../../domain/accounting/services/PostingFieldExtractor';
import { IVoucherTypeDefinitionRepository } from '../../../repository/interfaces/designer/IVoucherTypeDefinitionRepository';
import { VoucherStatus, VoucherType, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { IAccountingPolicyConfigProvider } from '../../../infrastructure/accounting/config/IAccountingPolicyConfigProvider';
import { AccountValidationService } from '../services/AccountValidationService';

/**
 * CreateVoucherUseCase
 * 
 * Saves a voucher in DRAFT status. 
 * NEVER persists ledger lines.
 */
export class CreateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private settingsRepo: ICompanyModuleSettingsRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private voucherTypeRepo: IVoucherTypeDefinitionRepository,
    private policyConfigProvider?: IAccountingPolicyConfigProvider,
    private ledgerRepo?: ILedgerRepository, // Needed for auto-post
    private policyRegistry?: any // Needed for auto-post
  ) {}
  
  private validationService = new VoucherValidationService();

  async execute(companyId: string, userId: string, payload: any): Promise<VoucherEntity> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
    
    return this.transactionManager.runTransaction(async (transaction) => {
      const settings: any = await this.settingsRepo.getSettings(companyId, 'accounting');
      // CRITICAL: baseCurrency must ALWAYS be the company's base currency, never from payload
      // Ledger entries MUST be in base currency only (accounting rule)
      const baseCurrency = (settings?.baseCurrency || 'USD').toUpperCase();
      const autoNumbering = settings?.autoNumbering !== false;

      const voucherId = payload.id || randomUUID();
      const voucherNo = autoNumbering ? `V-${Date.now()}` : payload.voucherNo || '';

      let lines: VoucherLineEntity[] = [];
      const voucherType = (payload.type as VoucherType) || VoucherType.JOURNAL_ENTRY;
      const strategy = VoucherPostingStrategyFactory.getStrategy(voucherType);

      if (strategy) {
        const voucherTypeDef = await this.voucherTypeRepo.getByCode(companyId, voucherType);
        let strategyInput = payload;
        
        if (voucherTypeDef && voucherTypeDef.headerFields && voucherTypeDef.headerFields.length > 0) {
          try {
            strategyInput = PostingFieldExtractor.extractPostingFields(payload, voucherTypeDef);
          } catch (error: any) {
            console.warn(`PostingFieldExtractor failed for ${voucherType}:`, error.message);
            strategyInput = payload;
          }
        }
        
        lines = await strategy.generateLines(strategyInput, companyId, baseCurrency);
      } else {
        // Map incoming lines to V2 VoucherLineEntity
        // Strictly V2 format (side, amount, baseAmount)
        lines = (payload.lines || []).map((l: any, idx: number) => {
          if (!l.side || l.amount === undefined) {
            throw new BusinessError(
              ErrorCode.VAL_REQUIRED_FIELD,
              `Line ${idx + 1}: Missing required V2 fields: side, amount`
            );
          }

          const fxAmount = Math.abs(Number(l.amount) || 0);
          const baseAmt = Math.abs(Number(l.baseAmount) || fxAmount); // Fallback to FX if base missing
          
          const lineCurrency = l.currency || l.lineCurrency || payload.currency || baseCurrency;
          const lineBaseCurrency = l.baseCurrency || baseCurrency;
          const rate = Number(l.exchangeRate) || Number(payload.exchangeRate) || 1;
          
          return new VoucherLineEntity(
            idx + 1,
            l.accountId!,
            l.side,
            baseAmt,           // baseAmount
            lineBaseCurrency,  // baseCurrency  
            fxAmount,          // amount
            lineCurrency,      // currency
            rate,              // exchangeRate
            l.notes || l.description,
            l.costCenterId,
            l.metadata || {}
          );
        });
      }


      const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);

      // Build metadata including source tracking fields
      const voucherMetadata = {
        ...payload.metadata,
        ...(payload.sourceModule && { sourceModule: payload.sourceModule }),
        ...(payload.formId && { formId: payload.formId }),
        ...(payload.prefix && { prefix: payload.prefix }),
      };

      // Check if Approval is OFF -> Auto-Post
      let approvalRequired = true;
      if (this.policyConfigProvider) {
        try {
          const config = await this.policyConfigProvider.getConfig(companyId);
          approvalRequired = config.approvalRequired;
        } catch (e) {}
      }

      // V3: Inject creationMode for audit transparency and badge logic
      // This ensures that even before posting, the intended governance mode is clear.
      const creationMode = approvalRequired ? 'STRICT' : 'FLEXIBLE';
      
      const voucher = new VoucherEntity(
        voucherId,
        companyId,
        voucherNo,
        voucherType,
        payload.date || new Date().toISOString().split('T')[0],
        payload.description || '',
        payload.currency || baseCurrency,
        baseCurrency,
        payload.exchangeRate || 1,
        lines,
        totalDebit,
        totalCredit,
        VoucherStatus.DRAFT,
        { ...voucherMetadata, creationMode }, // Inject creationMode here
        userId,
        new Date()
      );

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
        let lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
        if (registry) {
          try {
            const config = await registry.getConfig(companyId);
            
            // Align with PostVoucherUseCase: Check for strict gates (FA/CC)
            const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
            
            if (isStrictNow) {
              lockPolicy = PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
            } else if (config.allowEditPostedVouchersEnabled) {
              lockPolicy = PostingLockPolicy.FLEXIBLE_EDITABLE;
            } else {
              lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
            }
          } catch (e) {}
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

/**
 * UpdateVoucherUseCase
 * 
 * Updates a voucher while in DRAFT/REJECTED status.
 */
export class UpdateVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private policyConfigProvider?: IAccountingPolicyConfigProvider,
    private ledgerRepo?: ILedgerRepository
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, payload: any): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new BusinessError(ErrorCode.VOUCH_NOT_FOUND, 'Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.edit');
    
    // Check approval settings to determine allowed status transitions
    let approvalRequired = true; // Default to requiring approval
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        approvalRequired = config.approvalRequired;
      } catch (e) {}
    }

    // V3: Governance Guard for Editing Posted Vouchers
    // Determine mode and toggle from config
    let isStrictMode = true; // Default to strict
    let allowEditDeletePosted = false;
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        console.log('[UpdateVoucherUseCase] Loaded Policy Config:', JSON.stringify(config, null, 2));
        
        isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
        allowEditDeletePosted = config.allowEditDeletePosted ?? false;
        
        console.log('[UpdateVoucherUseCase] Policy Decision:', { isStrictMode, allowEditDeletePosted });
      } catch (e) {
        console.error('[UpdateVoucherUseCase] Failed to load config:', e);
      }
    }

    try {
      voucher.assertCanEdit(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isEditForbidden = error.message.includes('VOUCHER_POSTED_EDIT_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isEditForbidden) errorCode = ErrorCode.VOUCHER_POSTED_EDIT_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        error.message,
        { 
          status: voucher.status, 
          isPosted: voucher.isPosted,
          postingLockPolicy: voucher.postingLockPolicy,
          httpStatus: 423 
        }
      );
    }

    // Track if voucher was posted before update (for ledger resync)
    const wasPosted = voucher.isPosted;

    // Simplified update logic: create new entity with merged data
    // CRITICAL: baseCurrency must remain the company's base currency, never from payload
    const baseCurrency = voucher.baseCurrency.toUpperCase(); // Use existing voucher's base currency (company's base)
    const lines = payload.lines ? payload.lines.map((l: any, idx: number) => new VoucherLineEntity(
      idx + 1,
      l.accountId || voucher.lines[idx]?.accountId,
      l.side || voucher.lines[idx]?.side,
      l.baseAmount || voucher.lines[idx]?.baseAmount,
      baseCurrency,
      l.amount || voucher.lines[idx]?.amount,
      l.currency || voucher.lines[idx]?.currency,
      l.exchangeRate || voucher.lines[idx]?.exchangeRate,
      l.notes || voucher.lines[idx]?.notes,
      l.costCenterId || voucher.lines[idx]?.costCenterId,
      { ...voucher.lines[idx]?.metadata, ...l.metadata }
    )) : voucher.lines;

    const totalDebit = lines.reduce((s: number, l: any) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + l.creditAmount, 0);

    let updatedVoucher = new VoucherEntity(
      voucherId,
      companyId,
      payload.voucherNo || voucher.voucherNo,
      payload.type || voucher.type,
      payload.date || voucher.date,
      payload.description ?? voucher.description,
      payload.currency || voucher.currency,
      baseCurrency,
      payload.exchangeRate || voucher.exchangeRate,
      lines,
      totalDebit,
      totalCredit,
      // Allow status update only for valid transitions (respects approvalRequired setting)
      this.resolveStatus(voucher.status, payload.status, approvalRequired),
      { ...voucher.metadata, ...payload.metadata },
      voucher.createdBy,
      voucher.createdAt,
      voucher.approvedBy,
      voucher.approvedAt,
      voucher.rejectedBy,
      voucher.rejectedAt,
      voucher.rejectionReason,
      voucher.lockedBy,
      voucher.lockedAt,
      voucher.postedBy,
      voucher.postedAt,
      voucher.postingLockPolicy,
      voucher.reversalOfVoucherId,
      payload.reference || voucher.reference,
      new Date()
    );

    // If PENDING, mark as edited (Audit badge)
    if (updatedVoucher.isPending) {
       updatedVoucher = updatedVoucher.markAsEdited();
    }

    return this.transactionManager.runTransaction(async (transaction) => {
      // If the voucher was already POSTED, we must refresh ledger entries to reflect new changes
      if (voucher.isPosted) {
        if (!this.ledgerRepo) throw new Error('Ledger repository required for updating posted vouchers');
        
        // 1. Delete old ledger records
        await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
        
        // 2. Save updated voucher
        await this.voucherRepo.save(updatedVoucher);
        
        // 3. Re-record to ledger
        await this.ledgerRepo.recordForVoucher(updatedVoucher, transaction);
      } else {
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
  private resolveStatus(currentStatus: VoucherStatus, requestedStatus?: string, approvalRequired: boolean = true): VoucherStatus {
    if (!requestedStatus) {
      return currentStatus;
    }

    // When requesting 'pending' (submit for approval)
    if (requestedStatus === 'pending') {
      if (currentStatus === VoucherStatus.DRAFT || currentStatus === VoucherStatus.REJECTED) {
        // If approval is required, go to PENDING. Otherwise, skip to APPROVED.
        return approvalRequired ? VoucherStatus.PENDING : VoucherStatus.APPROVED;
      }
    }

    // For other cases, keep current status (invalid transitions ignored)
    return currentStatus;
  }
}

/**
 * ApproveVoucherUseCase
 * 
 * Satisfies the Financial Approval (FA) gate. 
 * If no other gates (like CC) are pending, transitions status to APPROVED.
 */
export class ApproveVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.approve');
    
    if (voucher.status !== VoucherStatus.PENDING) {
      throw new Error(`Cannot approve voucher with status: ${voucher.status}. Voucher must be in PENDING status.`);
    }

    // 1. Check if FA is required and pending
    const isFARequired = !!voucher.metadata?.financialApprovalRequired;
    const isFAPending = !!voucher.metadata?.pendingFinancialApproval;

    if (!isFAPending && isFARequired) {
       // Already satisfied
       return;
    }

    // 2. Determine if this satisfies ALL gates
    // CC is satisfied if the list is empty
    const pendingCC = voucher.metadata?.pendingCustodyConfirmations || [];
    const isFullySatisfied = pendingCC.length === 0;

    // 3. Transition
    const approvedVoucher = voucher.satisfyFinancialApproval(userId, new Date(), isFullySatisfied);
    await this.voucherRepo.save(approvedVoucher);
  }
}

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
export class PostVoucherUseCase {
  private validationService = new VoucherValidationService();

  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private transactionManager: ITransactionManager,
    private accountValidationService: AccountValidationService,
    private policyRegistry?: any // AccountingPolicyRegistry - optional for backward compatibility
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, correlationId?: string): Promise<void> {
    // Import logger and uuid here to avoid circular deps
    const { logger } = await import('../../../infrastructure/logging/StructuredLogger');
    const { v4: uuidv4 } = await import('uuid');
    const { PostingError } = await import('../../../domain/shared/errors/AppError');
    
    // Generate correlationId if not provided
    const corrId = correlationId || uuidv4();
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.post');
    
    return this.transactionManager.runTransaction(async (transaction) => {
      const voucher = await this.voucherRepo.findById(companyId, voucherId);
      if (!voucher) throw new Error('Voucher not found');

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
          
          // 1.1 Account Validation (Application Layer Check)
          // Validate all accounts used in lines (existence, status, role, currency policy)
          const distinctAccountIds = [...new Set(voucher.lines.map(l => l.accountId))];
          await Promise.all(distinctAccountIds.map(accId => 
             this.accountValidationService.validateAccountById(
               companyId, 
               userId, 
               accId, 
               voucher.type
             )
          ));
        } catch (error: any) {
          // Log core rejection
          logger.error('POST_REJECTED_CORE', {
            code: error.appError?.code || 'UNKNOWN',
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
              userId: userId, // For AccountAccessPolicy user scope lookup
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
            } catch (error: any) {
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
        let lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
        if (this.policyRegistry) {
          try {
            const config = await this.policyRegistry.getConfig(companyId);
            const isStrictNow = config.financialApprovalEnabled || config.custodyConfirmationEnabled;
            
            if (isStrictNow) {
              lockPolicy = PostingLockPolicy.STRICT_LOCKED; // AUDIT LOCK
            } else if (config.allowEditPostedVouchersEnabled) {
              lockPolicy = PostingLockPolicy.FLEXIBLE_EDITABLE;
            } else {
              lockPolicy = PostingLockPolicy.FLEXIBLE_LOCKED;
            }
          } catch (e) {}
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
        
      } catch (error) {
        // Error already logged in specific catch blocks
        throw error;
      }
    });
  }
}

export class CancelVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private policyConfigProvider?: IAccountingPolicyConfigProvider
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');
    
    // V3: Governance Guard for Deleting Posted Vouchers
    let isStrictMode = true; // Default to strict
    let allowEditDeletePosted = false;
    if (this.policyConfigProvider) {
      try {
        const config = await this.policyConfigProvider.getConfig(companyId);
        isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
        allowEditDeletePosted = config.allowEditDeletePosted ?? false;
      } catch (e) {}
    }
    
    try {
      voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isDeleteForbidden) errorCode = ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        `Cannot delete voucher: ${error.message}`,
        { 
          status: voucher.status, 
          isPosted: voucher.isPosted, 
          postingLockPolicy: voucher.postingLockPolicy,
          httpStatus: 423 
        }
      );
    }
    
    // V1: If voucher was posted, delete ledger entries
    if (voucher.isPosted) {
       await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
    
    const cancelledVoucher = voucher.cancel(userId, new Date(), 'Deleted by user');
    await this.voucherRepo.save(cancelledVoucher);
  }
}

export class DeleteVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker,
    private configProvider: IAccountingPolicyConfigProvider
  ) {}

  async execute(companyId: string, userId: string, voucherId: string) {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    // Explicit DELETE permission check (distinct from CANCEL)
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.delete');

    // Load policy
    let config;
    try {
      config = await this.configProvider.getConfig(companyId);
    } catch (e) {
      config = {} as any;
    }

    // Policy Check - Align with PostVoucherUseCase & UpdateVoucherUseCase
    const isStrictMode = (config.strictApprovalMode || config.financialApprovalEnabled || config.approvalRequired) ?? true;
    const allowEditDeletePosted = config.allowEditDeletePosted ?? false;
    
    try {
      voucher.assertCanDelete(isStrictMode, allowEditDeletePosted);
    } catch (error: any) {
      const isStrictForever = error.message.includes('VOUCHER_STRICT_LOCK_FOREVER');
      const isDeleteForbidden = error.message.includes('VOUCHER_POSTED_DELETE_FORBIDDEN');
      
      let errorCode = ErrorCode.VOUCH_LOCKED;
      if (isStrictForever) errorCode = ErrorCode.VOUCHER_STRICT_LOCK_FOREVER;
      else if (isDeleteForbidden) errorCode = ErrorCode.VOUCHER_POSTED_DELETE_FORBIDDEN;
      
      throw new BusinessError(
        errorCode,
        `Cannot delete voucher: ${error.message}`,
        { httpStatus: 423 }
      );
    }
    
    // Clean up ledger entries if posted
    if (voucher.isPosted) {
       await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
    
    // HARD DELETE the voucher record
    await this.voucherRepo.delete(companyId, voucherId);
  }
}

export class GetVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return voucher;
  }
}

export class ListVouchersUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, limit?: number): Promise<VoucherEntity[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return this.voucherRepo.findByCompany(companyId, limit);
  }
}
