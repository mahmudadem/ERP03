import { randomUUID } from 'crypto';
import { FiscalYear, FiscalYearStatus, FiscalPeriod, PeriodStatus, PeriodScheme } from '../../../domain/accounting/entities/FiscalYear';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { VoucherLineEntity } from '../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherEntity } from '../../../domain/accounting/entities/VoucherEntity';
import { VoucherType, VoucherStatus, PostingLockPolicy } from '../../../domain/accounting/types/VoucherTypes';
import { ITransactionManager } from '../../../repository/interfaces/shared/ITransactionManager';
import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';
import { AccountClassification, BalanceNature } from '../../../domain/accounting/models/Account';

const iso = (d: Date) => d.toISOString().split('T')[0];

import { FiscalPeriodGenerator } from '../../../domain/accounting/services/FiscalPeriodGenerator';

export class CreateFiscalYearUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, params: { year: number | string; startMonth: number; name?: string; periodScheme?: PeriodScheme }) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    
    // Default scheme to MONTHLY if not provided
    const scheme = params.periodScheme || PeriodScheme.MONTHLY;

    // Validate Period Scheme
    if (!Object.values(PeriodScheme).includes(scheme)) {
       const err = new Error('Invalid Period Scheme');
       (err as any).code = 'INVALID_PERIOD_SCHEME';
       (err as any).details = { periodScheme: scheme };
       throw err;
    }

    const startMonth = Math.min(Math.max(params.startMonth, 1), 12);
    
    let yearNum: number;
    if (typeof params.year === 'string') {
        const d = new Date(params.year);
        yearNum = d.getFullYear();
    } else {
        yearNum = params.year;
    }

    const startDate = new Date(yearNum, startMonth - 1, 1);
    const endDate = new Date(yearNum, startMonth - 1 + 12, 0);

    // Prevent Overlapping Fiscal Years
    const existingYears = await this.fiscalYearRepo.findByCompany(companyId);
    const startIso = iso(startDate);
    const endIso = iso(endDate);

    const overlap = existingYears.find(fy => {
      return fy.startDate <= endIso && fy.endDate >= startIso;
    });

    if (overlap) {
       const err = new Error(`Overlapping fiscal year found: ${overlap.name} (${overlap.startDate} to ${overlap.endDate})`);
       (err as any).code = 'FISCAL_YEAR_OVERLAP';
       (err as any).status = 400;
       throw err;
    }

    // Special periods are NEVER created automatically anymore as per user request.
    // They are added later via EnableSpecialPeriodsUseCase.
    const spCount = 0;

    const periods = FiscalPeriodGenerator.generate(startDate, endDate, scheme, spCount);
    const fyId = `FY${endDate.getFullYear()}`; 

    const fiscalYear = new FiscalYear(
      fyId,
      companyId,
      params.name || `Fiscal Year ${endDate.getFullYear()}`,
      iso(startDate),
      iso(endDate),
      FiscalYearStatus.OPEN,
      periods,
      undefined,
      new Date(),
      userId,
      scheme,
      spCount
    );

    await this.fiscalYearRepo.save(fiscalYear);
    return fiscalYear;
  }
}


export class ListFiscalYearsUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.read');
    return this.fiscalYearRepo.findByCompany(companyId);
  }
}

export class ClosePeriodUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string, periodId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');
    
    if (fy.status === 'CLOSED') {
      throw new Error('Cannot change period status because the fiscal year is closed.');
    }

    const updated = fy.closePeriod(periodId, userId);
    await this.fiscalYearRepo.update(updated);
    return updated;
  }
}

export class ReopenPeriodUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string, periodId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');

    if (fy.status === 'CLOSED') {
      throw new Error('Cannot change period status because the fiscal year is closed.');
    }

    const updated = fy.reopenPeriod(periodId);
    await this.fiscalYearRepo.update(updated);
    return updated;
  }
}

export class CloseYearUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly accountRepo: IAccountRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(
    companyId: string,
    userId: string,
    fiscalYearId: string,
    params: { retainedEarningsAccountId: string, pandLClearingAccountId?: string }
  ) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');

    // If there is already a DRAFT closing voucher for this year, we delete it before regenerating
    if (fy.closingVoucherId) {
      const existingDraft = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
      if (existingDraft && !existingDraft.isPosted) {
        await this.voucherRepo.delete(companyId, fy.closingVoucherId);
      } else if (existingDraft && existingDraft.isPosted) {
         throw new Error('This year is already closed and has a posted closing voucher.');
      }
    }

    const asOfDate = fy.endDate;
    const company = await this.companyRepo.findById(companyId).catch(() => null as any);
    const baseCurrency = (company as any)?.baseCurrency || 'USD';

    const trial = await this.ledgerRepo.getTrialBalance(companyId, asOfDate);
    const accounts = await this.accountRepo.list(companyId);
    
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const tbMap = new Map(trial.map((r) => [r.accountId, r]));

    let revenueTotal = 0;
    let expenseTotal = 0;
    const lines: VoucherLineEntity[] = [];
    
    // We will accumulate exactly how much hitting the P&L Clearing Account
    let clearingNetCredit = 0; // Positive = we are crediting clearing (Net Profit)
    const useClearing = !!params.pandLClearingAccountId;

    accounts.forEach((acc) => {
      const tb = tbMap.get(acc.id);
      if (!tb) return;
      
      const net = (tb.debit || 0) - (tb.credit || 0); // debit positive

      if (acc.classification === 'REVENUE') {
        const amount = Math.abs(net);
        revenueTotal += amount;
        if (amount > 0) {
          // Normal Revenue is Credit. To close it, we Debit it.
          // If the net is DEBIT (abnormal), we Credit it to close it.
          const sideToClose = net > 0 ? 'Credit' : 'Debit';
          
          lines.push(
            new VoucherLineEntity(lines.length + 1, acc.id, sideToClose, amount, baseCurrency, amount, baseCurrency, 1)
          );
          
          if (useClearing) {
            // Offset goes to P&L Clearing
             const clearingSide = sideToClose === 'Debit' ? 'Credit' : 'Debit';
             lines.push(
               new VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId!, clearingSide, amount, baseCurrency, amount, baseCurrency, 1)
             );
             clearingNetCredit += (clearingSide === 'Credit' ? amount : -amount);
          }
        }
      } else if (acc.classification === 'EXPENSE') {
        const amount = Math.abs(net);
        expenseTotal += amount;
        if (amount > 0) {
           // Normal Expense is Debit. To close it, we Credit it.
           // If the net is CREDIT (abnormal), we Debit it to close it.
           const sideToClose = net > 0 ? 'Credit' : 'Debit';
           
           lines.push(
             new VoucherLineEntity(lines.length + 1, acc.id, sideToClose, amount, baseCurrency, amount, baseCurrency, 1)
           );
           
           if (useClearing) {
             const clearingSide = sideToClose === 'Debit' ? 'Credit' : 'Debit';
             lines.push(
               new VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId!, clearingSide, amount, baseCurrency, amount, baseCurrency, 1)
             );
             clearingNetCredit += (clearingSide === 'Credit' ? amount : -amount);
           }
        }
      }
    });

    const netIncome = revenueTotal - expenseTotal; // positive = profit
    const summary = {
      revenueTotal,
      expenseTotal,
      netIncome,
      baseCurrency
    };

    const retainedAccount = accountMap.get(params.retainedEarningsAccountId);
    if (!retainedAccount) throw new Error('Retained earnings account not found');

    if (useClearing) {
       // We must clear the P&L Clearing account to Retained Earnings
       // clearingNetCredit is the net balance sitting in P&L Clearing right now (Credit = Profit)
       // To close it out, if it's Credit, we Debit the Clearing Account and Credit Retained Earnings
       if (clearingNetCredit !== 0) {
          const sideToCloseClearing = clearingNetCredit > 0 ? 'Debit' : 'Credit';
          const sideForRetained = clearingNetCredit > 0 ? 'Credit' : 'Debit';
          const amount = Math.abs(clearingNetCredit);
          
          lines.push(
            new VoucherLineEntity(lines.length + 1, params.pandLClearingAccountId!, sideToCloseClearing, amount, baseCurrency, amount, baseCurrency, 1)
          );
          lines.push(
            new VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, sideForRetained, amount, baseCurrency, amount, baseCurrency, 1)
          );
       } else {
         // Both zero, just anchor Retained Earnings to make the voucher valid
         lines.push(new VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Credit', 0, baseCurrency, 0, baseCurrency, 1));
         lines.push(new VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Debit', 0, baseCurrency, 0, baseCurrency, 1));
       }
    } else {
       // Direct routing (NO P&L Clearing)
       const retainedSide = netIncome >= 0 ? 'Credit' : 'Debit';
       const retainedAmount = Math.abs(netIncome);
       
       lines.push(
         new VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, retainedSide, retainedAmount, baseCurrency, retainedAmount, baseCurrency, 1)
       );

       if (lines.length === 1 && retainedAmount === 0) {
         lines.push(new VoucherLineEntity(lines.length + 1, params.retainedEarningsAccountId, 'Debit', 0, baseCurrency, 0, baseCurrency, 1));
       }
    }

    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Closing entry not balanced (Debit: ${totalDebit}, Credit: ${totalCredit}). Check account classifications.`);
    }

    const voucherId = randomUUID();
    const voucher = new VoucherEntity(
      voucherId,
      companyId,
      `CLOSE-${fy.id.substring(0,8).toUpperCase()}`,
      VoucherType.JOURNAL_ENTRY,
      asOfDate,
      `Year-end closing for ${fy.name}`,
      baseCurrency,
      baseCurrency,
      1,
      lines,
      totalDebit,
      totalCredit,
      VoucherStatus.DRAFT, // IMPORTANT: Now saved as DRAFT
      { systemGenerated: true, closingFiscalYear: fy.id, clearingAccountUsed: useClearing },
      userId,
      new Date(),
      undefined, // not approved yet
      undefined
    );

    // Link the DRAFT voucher to the FY without actually "Closing" the FY yet
    const updatedFy = new FiscalYear(
       fy.id, 
       fy.companyId, 
       fy.name, 
       fy.startDate, 
       fy.endDate, 
       fy.status, 
       fy.periods,
       voucher.id, // Set the closingVoucherId to our new Draft
       fy.createdAt,
       fy.createdBy,
       fy.periodScheme,
       fy.specialPeriodsCount
    );

    await this.transactionManager.runTransaction(async (tx) => {
      await this.voucherRepo.save(voucher);
      await this.fiscalYearRepo.update(updatedFy);
    });

    return { 
      voucherId: voucher.id,
      ...summary
    };
  }
}

export class CommitYearCloseUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');

    if (!fy.closingVoucherId) {
       throw new Error('No draft closing voucher found for this fiscal year. Please generate one first.');
    }

    const draftVoucher = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
    if (!draftVoucher) throw new Error('Draft closing voucher not found');
    
    if (draftVoucher.isPosted) {
       throw new Error('Closing voucher is already posted.');
    }

    // Approve and Post the draft voucher
    const approved = draftVoucher.approve(userId, new Date());
    const posted = approved.post(userId, new Date(), PostingLockPolicy.STRICT_LOCKED);

    // Finally, close the Fiscal Year strictly
    const closedFy = fy.closeYear(userId, posted.id);

    await this.transactionManager.runTransaction(async (tx) => {
      await this.voucherRepo.save(posted);
      await this.ledgerRepo.recordForVoucher(posted, tx as any);
      await this.fiscalYearRepo.update(closedFy);
    });

    return { 
      voucherId: posted.id,
      success: true
    };
  }
}

export class ReopenYearUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly voucherRepo: IVoucherRepository,
    private readonly ledgerRepo: ILedgerRepository,
    private readonly transactionManager: ITransactionManager,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');

    // Audit Correction: If there is a closing voucher, we must reverse it
    let reversalVoucher: VoucherEntity | null = null;
    let originalVoucher: VoucherEntity | null = null;

    if (fy.closingVoucherId) {
      originalVoucher = await this.voucherRepo.findById(companyId, fy.closingVoucherId);
      if (originalVoucher && originalVoucher.isPosted) {
        const ledgerLines = await this.ledgerRepo.getGeneralLedger(companyId, { voucherId: originalVoucher.id });
        
        reversalVoucher = originalVoucher.createReversal(
          randomUUID(),
          iso(new Date()), // Today
          randomUUID(),
          userId,
          ledgerLines,
          `Invalidating closure of ${fy.name} for adjustments.`
        );

        // Link and mark as reversed for audit trail
        originalVoucher = originalVoucher.markAsReversed(reversalVoucher.id);

        // Auto-approve and post the reversal (system event)
        reversalVoucher = reversalVoucher.approve(userId, new Date());
        reversalVoucher = reversalVoucher.post(userId, new Date(), PostingLockPolicy.STRICT_LOCKED);
      }
    }

    const updated = fy.reopenYear();

    await this.transactionManager.runTransaction(async (tx) => {
      if (reversalVoucher && originalVoucher) {
        await this.voucherRepo.save(originalVoucher); // Save with isReversed flag from createReversal
        await this.voucherRepo.save(reversalVoucher);
        await this.ledgerRepo.recordForVoucher(reversalVoucher, tx as any);
      }
      await this.fiscalYearRepo.update(updated);
    });

    return updated;
  }
}

export class DeleteFiscalYearUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly voucherRepo: IVoucherRepository, // Added dependency
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    
    if (!fy) {
      throw new Error('Fiscal year not found');
    }

    // Prevent deletion if the year is CLOSED
    if (fy.status === FiscalYearStatus.CLOSED) {
      throw new Error('Cannot delete a CLOSED fiscal year. You must reopen it first.');
    }

    // Prevent deletion if any period is CLOSED (includes special periods)
    const hasClosedPeriods = fy.periods.some(p => p.status === PeriodStatus.CLOSED);
    if (hasClosedPeriods) {
      throw new Error('Cannot delete fiscal year with CLOSED periods. Open all periods first.');
    }

    // NEW BLOCK: Prevent deletion if ANY vouchers exist for this year
    // This protects data integrity and prevents orphaning special period vouchers
    const vouchers = await this.voucherRepo.findByDateRange(companyId, fy.startDate, fy.endDate, 1);
    if (vouchers.length > 0) {
      throw new BusinessError(
        ErrorCode.ACC_FISCAL_YEAR_DELETE_FORBIDDEN,
        `Cannot delete Fiscal Year "${fy.name}". It contains vouchers. You must delete or move the vouchers first.`,
        { fyId: fiscalYearId, voucherCount: 'at least 1' }
      );
    }

    // Ideally we should also check if there are any POSTED vouchers in this period range.
    // However, since vouchers are linked by DATE and not FY ID, deleting the FY definition 
    // doesn't orphan the vouchers, it just removes the "container".
    // Re-creating the FY later will re-capture them.
    // So deletion is safe regarding data integrity, but might be confusing.
    // We will allow it for open years.

    await this.fiscalYearRepo.delete(companyId, fiscalYearId);
  }
}


export class EnableSpecialPeriodsUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fiscalYearId: string, definitions: { name: string }[]) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    
    const count = definitions.length;
    if (count < 0 || count > 4) {
      throw new BusinessError(
        ErrorCode.VAL_INVALID_RANGE,
        'Special periods count must be between 0 and 4',
        { count }
      );
    }

    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new BusinessError(ErrorCode.FISCAL_YEAR_NOT_FOUND, 'Fiscal year not found');

    const dStart = new Date(fy.startDate);
    const dEnd = new Date(fy.endDate);
    
    const newPeriodsList = FiscalPeriodGenerator.generate(
       dStart, 
       dEnd, 
       fy.periodScheme, 
       count
    );
    
    // Apply custom names to special periods
    const namedPeriods = newPeriodsList.map(p => {
      if (p.isSpecial) {
        const defIndex = p.periodNo - 13;
        if (definitions[defIndex]?.name) {
          return { ...p, name: definitions[defIndex].name };
        }
      }
      return p;
    });

    // Merge existing status into new list
    const mergedPeriods = namedPeriods.map(newP => {
      const existing = fy.periods.find(p => p.id === newP.id);
      if (existing) {
        return {
          ...newP,
          status: existing.status,
          closedAt: existing.closedAt,
          closedBy: existing.closedBy,
          lockedAt: existing.lockedAt,
          lockedBy: existing.lockedBy,
          metadata: { ...existing.metadata, ...newP.metadata }
        };
      }
      return newP;
    });
    
    const updated = new FiscalYear(
      fy.id, 
      fy.companyId, 
      fy.name, 
      fy.startDate, 
      fy.endDate, 
      fy.status, 
      mergedPeriods,
      fy.closingVoucherId,
      fy.createdAt,
      fy.createdBy,
      fy.periodScheme,
      count
    );

    await this.fiscalYearRepo.update(updated);
    return updated;
  }
}

export class AutoCreateRetainedEarningsUseCase {
  constructor(
    private readonly accountRepo: IAccountRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    
    const accounts = await this.accountRepo.list(companyId);
    
    // Idempotency Check: Look for existing "Retained Earnings"
    const existing = accounts.find(a => 
      a.name.trim().toLowerCase() === 'retained earnings'
    );

    if (existing) {
      return { 
        account: existing, 
        created: false, 
        message: 'Retained Earnings account already exists.' 
      };
    }

    // Find a free code starting at 30200
    let code = 30200;
    const usedCodes = new Set(accounts.map(a => a.userCode));
    while (usedCodes.has(code.toString())) {
      code++;
    }
    const finalCode = code.toString();

    // Create the account
    const newAccount = await this.accountRepo.create(companyId, {
      userCode: finalCode,
      name: 'Retained Earnings',
      classification: 'EQUITY', // AccountClassification.EQUITY
      createdBy: userId,
      description: 'System-generated account for annual profit/loss retention.',
      balanceNature: 'CREDIT', // BalanceNature.CREDIT
      isProtected: true // Protect system account
    });

    return { 
      account: newAccount, 
      created: true, 
      message: `Created Retained Earnings account with code ${finalCode}` 
    };
  }
}

