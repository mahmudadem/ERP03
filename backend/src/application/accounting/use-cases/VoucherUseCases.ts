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
import { VoucherStatus, VoucherType } from '../../../domain/accounting/types/VoucherTypes';
import { VoucherValidationService } from '../../../domain/accounting/services/VoucherValidationService';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

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
    private voucherTypeRepo: IVoucherTypeDefinitionRepository
  ) {}

  async execute(companyId: string, userId: string, payload: any): Promise<VoucherEntity> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');
    
    return this.transactionManager.runTransaction(async (transaction) => {
      const settings: any = await this.settingsRepo.getSettings(companyId, 'accounting');
      const baseCurrency = settings?.baseCurrency || payload.baseCurrency || payload.currency;
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
        
        lines = await strategy.generateLines(strategyInput, companyId);
      } else {
        lines = (payload.lines || []).map((l: any, idx: number) => new VoucherLineEntity(
          idx + 1,
          l.accountId!,
          l.side || (l.debitFx > 0 ? 'Debit' : 'Credit'),
          l.amount || l.debitFx || l.creditFx,
          l.currency || payload.currency,
          l.baseAmount || (l.debitBase || l.creditBase),
          l.baseCurrency || baseCurrency,
          l.exchangeRate || payload.exchangeRate || 1,
          l.notes || l.description,
          l.costCenterId,
          l.metadata || {}
        ));
      }

      const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
      const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);

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
        payload.metadata || {},
        userId,
        new Date()
      );

      await this.voucherRepo.save(voucher);
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
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, payload: any): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new BusinessError(ErrorCode.VOUCH_NOT_FOUND, 'Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.update');
    
    if (!voucher.canEdit) {
      throw new BusinessError(
        ErrorCode.VOUCH_INVALID_STATUS,
        `Cannot update voucher with status: ${voucher.status}. POSTED vouchers must be corrected via reverse/new.`
      );
    }

    // Simplified update logic: create new entity with merged data
    // In production, you would probably have a clearer mapping
    const baseCurrency = payload.baseCurrency || voucher.baseCurrency;
    const lines = payload.lines ? payload.lines.map((l: any, idx: number) => new VoucherLineEntity(
      idx + 1,
      l.accountId || voucher.lines[idx]?.accountId,
      l.side || voucher.lines[idx]?.side,
      l.amount || voucher.lines[idx]?.amount,
      l.currency || voucher.lines[idx]?.currency,
      l.baseAmount || voucher.lines[idx]?.baseAmount,
      baseCurrency,
      l.exchangeRate || voucher.lines[idx]?.exchangeRate,
      l.notes || voucher.lines[idx]?.notes,
      l.costCenterId || voucher.lines[idx]?.costCenterId,
      { ...voucher.lines[idx]?.metadata, ...l.metadata }
    )) : voucher.lines;

    const totalDebit = lines.reduce((s: number, l: any) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s: number, l: any) => s + l.creditAmount, 0);

    const updatedVoucher = new VoucherEntity(
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
      voucher.status, // Keep status same
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
      voucher.postedAt
    );

    await this.voucherRepo.save(updatedVoucher);
  }
}

/**
 * ApproveVoucherUseCase
 * 
 * Sets status to APPROVED. No ledger impact.
 */
export class ApproveVoucherUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.approve');
    
    if (voucher.status !== VoucherStatus.DRAFT) {
      throw new Error(`Cannot approve voucher with status: ${voucher.status}`);
    }
    
    const approvedVoucher = voucher.approve(userId, new Date());
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
    private policyRegistry?: any // AccountingPolicyRegistry - optional for backward compatibility
  ) {}

  async execute(companyId: string, userId: string, voucherId: string, correlationId?: string): Promise<void> {
    // Import logger and uuid here to avoid circular deps
    const { logger } = await import('../../../infrastructure/logging/StructuredLogger');
    const { v4: uuidv4 } = await import('uuid');
    const { PostingError } = await import('../../../domain/shared/errors/AppError');
    
    // Generate correlationId if not provided
    const corrId = correlationId || uuidv4();
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.post');
    
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
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string): Promise<void> {
    const voucher = await this.voucherRepo.findById(companyId, voucherId);
    if (!voucher) throw new Error('Voucher not found');
    
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.cancel');
    
    if (voucher.status === VoucherStatus.LOCKED) {
      throw new Error('Cannot cancel a locked voucher');
    }

    // If it was posted, we must delete ledger entries
    if (voucher.status === VoucherStatus.POSTED) {
       await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
    }
    
    const cancelledVoucher = voucher.reject(userId, new Date(), 'Cancelled by user');
    await this.voucherRepo.save(cancelledVoucher);
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
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
    return voucher;
  }
}

export class ListVouchersUseCase {
  constructor(
    private voucherRepo: IVoucherRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, limit?: number): Promise<VoucherEntity[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'voucher.view');
    return this.voucherRepo.findByCompany(companyId, limit);
  }
}
