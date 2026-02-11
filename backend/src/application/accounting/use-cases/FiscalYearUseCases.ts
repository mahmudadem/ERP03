import { randomUUID } from 'crypto';
import { FiscalYear, FiscalYearStatus, FiscalPeriod, PeriodStatus } from '../../../domain/accounting/entities/FiscalYear';
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

const iso = (d: Date) => d.toISOString().split('T')[0];

const generatePeriods = (year: number, startMonth: number): FiscalPeriod[] => {
  const periods: FiscalPeriod[] = [];
  for (let i = 0; i < 12; i++) {
    const start = new Date(year, startMonth - 1 + i, 1);
    const end = new Date(year, startMonth - 1 + i + 1, 0);
    const id = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    const name = start.toLocaleString('en', { month: 'long', year: 'numeric' });
    periods.push({
      id,
      name,
      startDate: iso(start),
      endDate: iso(end),
      status: PeriodStatus.OPEN
    });
  }
  return periods;
};

export class CreateFiscalYearUseCase {
  constructor(
    private readonly fiscalYearRepo: IFiscalYearRepository,
    private readonly companyRepo: ICompanyRepository,
    private readonly permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, params: { year: number; startMonth: number; name?: string }) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');

    const startMonth = Math.min(Math.max(params.startMonth, 1), 12);
    const startDate = new Date(params.year, startMonth - 1, 1);
    const endDate = new Date(params.year, startMonth - 1 + 12, 0);
    const id = `FY${params.year}`;
    const name = params.name || `Fiscal Year ${params.year}`;
    const periods = generatePeriods(params.year, startMonth);

    const fy = new FiscalYear(
      id,
      companyId,
      name,
      iso(startDate),
      iso(endDate),
      FiscalYearStatus.OPEN,
      periods,
      undefined,
      new Date(),
      userId
    );

    await this.fiscalYearRepo.save(fy);
    return fy;
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
    params: { retainedEarningsAccountId: string }
  ) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYearRepo.findById(companyId, fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');

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

    accounts.forEach((acc) => {
      const tb = tbMap.get(acc.id);
      if (!tb) return;
      const net = (tb.debit || 0) - (tb.credit || 0); // debit positive

      if (acc.classification === 'REVENUE') {
        const amount = Math.abs(net);
        revenueTotal += amount;
        if (amount > 0) {
          lines.push(
            new VoucherLineEntity(
              lines.length + 1,
              acc.id,
              'Debit',
              amount,
              baseCurrency,
              amount,
              baseCurrency,
              1
            )
          );
        }
      } else if (acc.classification === 'EXPENSE') {
        const amount = Math.abs(net);
        expenseTotal += amount;
        if (amount > 0) {
          lines.push(
            new VoucherLineEntity(
              lines.length + 1,
              acc.id,
              'Credit',
              amount,
              baseCurrency,
              amount,
              baseCurrency,
              1
            )
          );
        }
      }
    });

    const netIncome = revenueTotal - expenseTotal; // positive = profit
    const retainedSide = netIncome >= 0 ? 'Credit' : 'Debit';
    const retainedAmount = Math.abs(netIncome);
    if (retainedAmount > 0) {
      const retainedAccount = accountMap.get(params.retainedEarningsAccountId);
      if (!retainedAccount) throw new Error('Retained earnings account not found');
      lines.push(
        new VoucherLineEntity(
          lines.length + 1,
          params.retainedEarningsAccountId,
          retainedSide,
          retainedAmount,
          baseCurrency,
          retainedAmount,
          baseCurrency,
          1
        )
      );
    }

    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error('Closing entry not balanced');
    }

    const voucherId = randomUUID();
    const voucher = new VoucherEntity(
      voucherId,
      companyId,
      `CLOSE-${fy.id}`,
      VoucherType.JOURNAL_ENTRY,
      asOfDate,
      `Year-end closing for ${fy.name}`,
      baseCurrency,
      baseCurrency,
      1,
      lines,
      totalDebit,
      totalCredit,
      VoucherStatus.APPROVED,
      { systemGenerated: true, closingFiscalYear: fy.id },
      userId,
      new Date(),
      userId,
      new Date()
    );

    const posted = voucher.post(userId, new Date(), PostingLockPolicy.STRICT_LOCKED);

    await this.transactionManager.runTransaction(async (tx) => {
      await this.ledgerRepo.recordForVoucher(posted, tx as any);
      await this.voucherRepo.save(posted);
      const closed = fy.closeYear(userId, posted.id);
      await this.fiscalYearRepo.update(closed);
    });

    return { voucherId: posted.id };
  }
}
