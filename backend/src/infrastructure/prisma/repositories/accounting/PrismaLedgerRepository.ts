/**
 * PrismaLedgerRepository
 *
 * SQL implementation of ILedgerRepository using Prisma.
 * Handles ledger entry recording, trial balance, general ledger queries,
 * account statements, and reconciliation-related operations.
 */

import { PrismaClient } from '@prisma/client';
import { ILedgerRepository, TrialBalanceRow, ForeignBalanceRow, GLFilters, AccountStatementEntry, AccountStatementData } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { LedgerEntry } from '../../../../domain/accounting/models/LedgerEntry';
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';

export class PrismaLedgerRepository implements ILedgerRepository {
  constructor(private prisma: PrismaClient) {}

  // =========================================================================
  // MAPPING HELPERS
  // =========================================================================

  private toDomain(record: any): LedgerEntry {
    return {
      id: record.id,
      companyId: record.companyId,
      accountId: record.accountId,
      voucherId: record.voucherId || '',
      voucherLineId: record.voucherLineId || 0,
      date: record.date instanceof Date ? record.date.toISOString() : record.date,
      debit: record.debit ?? 0,
      credit: record.credit ?? 0,
      currency: record.currency,
      amount: record.amount ?? 0,
      baseCurrency: record.baseCurrency,
      baseAmount: record.baseAmount ?? 0,
      exchangeRate: record.exchangeRate ?? 1.0,
      side: record.side as 'Debit' | 'Credit',
      notes: record.notes || record.description || undefined,
      costCenterId: record.costCenterId || undefined,
      metadata: record.metadata || undefined,
      isPosted: record.isPosted ?? true,
      reconciliationId: record.reconciliationId || undefined,
      bankStatementLineId: record.bankStatementLineId || undefined,
      createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
      postingPeriodNo: record.postingPeriodNo ?? null,
      isSpecial: record.isSpecial ?? false,
    };
  }

  // =========================================================================
  // MUTATION METHODS
  // =========================================================================

  async recordForVoucher(voucher: VoucherEntity, transaction?: any): Promise<void> {
    const tx = transaction || this.prisma;
    const dateValue = typeof voucher.date === 'string' ? new Date(voucher.date) : voucher.date;

    const entries = voucher.lines.map((line, index) => ({
      id: `${voucher.id}-ledger-${index + 1}`,
      company: { connect: { id: voucher.companyId } },
      account: { connect: { id: line.accountId } },
      voucherId: voucher.id,
      date: dateValue,
      description: line.notes || voucher.description || null,
      debit: line.side === 'Debit' ? line.baseAmount : 0,
      credit: line.side === 'Credit' ? line.baseAmount : 0,
      balance: 0,
      currency: line.currency,
      baseCurrency: line.baseCurrency,
      exchangeRate: line.exchangeRate,
      postingSeq: index + 1,
    }));

    await tx.ledgerEntry.createMany({
      data: entries as any,
    });
  }

  async deleteForVoucher(companyId: string, voucherId: string, transaction?: any): Promise<void> {
    const tx = transaction || this.prisma;
    await tx.ledgerEntry.deleteMany({
      where: { companyId, voucherId },
    });
  }

  // =========================================================================
  // QUERY METHODS
  // =========================================================================

  async getAccountLedger(companyId: string, accountId: string, fromDate: string, toDate: string): Promise<LedgerEntry[]> {
    const records = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        accountId,
        date: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
      orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
    });

    let runningBalance = 0;
    return records.map((r) => {
      const entry = this.toDomain(r);
      runningBalance += entry.debit - entry.credit;
      return entry;
    });
  }

  async getTrialBalance(companyId: string, asOfDate: string, excludeSpecialPeriods?: boolean): Promise<TrialBalanceRow[]> {
    const date = new Date(asOfDate);

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        companyId,
        date: { lte: date },
      },
      include: { account: true },
      orderBy: [{ accountId: 'asc' }],
    });

    const accountMap = new Map<string, { accountId: string; accountCode: string; accountName: string; debit: number; credit: number }>();

    for (const entry of ledgerEntries) {
      if (!entry.account) continue;
      const key = entry.accountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: entry.accountId,
          accountCode: entry.account.userCode,
          accountName: entry.account.name,
          debit: 0,
          credit: 0,
        });
      }
      const row = accountMap.get(key)!;
      row.debit += entry.debit ?? 0;
      row.credit += entry.credit ?? 0;
    }

    return Array.from(accountMap.values()).map((row) => ({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      debit: row.debit,
      credit: row.credit,
      balance: row.debit - row.credit,
    }));
  }

  async getGeneralLedger(companyId: string, filters: GLFilters): Promise<LedgerEntry[]> {
    const where: any = { companyId };

    if (filters.accountId) {
      where.accountId = filters.accountId;
    }
    if (filters.voucherId) {
      where.voucherId = filters.voucherId;
    }
    if (filters.fromDate) {
      where.date = { ...(where.date || {}), gte: new Date(filters.fromDate) };
    }
    if (filters.toDate) {
      where.date = { ...(where.date || {}), lte: new Date(filters.toDate) };
    }
    if (filters.voucherType) {
      where.voucher = { type: filters.voucherType } as any;
    }
    if (filters.costCenterId) {
      where.costCenterId = filters.costCenterId;
    }

    const records = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
      take: filters.limit || 1000,
      skip: filters.offset || 0,
    });

    return records.map((r) => this.toDomain(r));
  }

  async getAccountStatement(
    companyId: string,
    accountId: string,
    fromDate: string,
    toDate: string,
    options?: { includeUnposted?: boolean; costCenterId?: string; currency?: string }
  ): Promise<AccountStatementData> {
    const where: any = { companyId, accountId };

    if (options?.costCenterId) {
      where.costCenterId = options.costCenterId;
    }
    if (options?.currency) {
      where.currency = options.currency;
    }

    const dateFrom = new Date(fromDate);
    const dateTo = new Date(toDate);

    // Get entries within the period
    const entries = await this.prisma.ledgerEntry.findMany({
      where: {
        ...where,
        date: { gte: dateFrom, lte: dateTo },
      },
      orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
    });

    // Calculate opening balance (all entries before the period)
    const openingEntries = await this.prisma.ledgerEntry.findMany({
      where: {
        ...where,
        date: { lt: dateFrom },
      },
    });

    let openingBalance = 0;
    for (const e of openingEntries) {
      openingBalance += (e.debit ?? 0) - (e.credit ?? 0);
    }

    // Get account info
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, companyId },
    });

    const company = await this.prisma.company.findFirst({
      where: { id: companyId },
    });

    // Build statement entries with running balance
    let runningBalance = openingBalance;
    let runningBaseBalance = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalBaseDebit = 0;
    let totalBaseCredit = 0;

    const statementEntries: AccountStatementEntry[] = entries.map((r) => {
      const debit = r.debit ?? 0;
      const credit = r.credit ?? 0;
      runningBalance += debit - credit;
      totalDebit += debit;
      totalCredit += credit;

      const baseDebit = (r as any).baseAmount && debit > 0 ? (r as any).baseAmount : 0;
      const baseCredit = (r as any).baseAmount && credit > 0 ? (r as any).baseAmount : 0;
      runningBaseBalance += baseDebit - baseCredit;
      totalBaseDebit += baseDebit;
      totalBaseCredit += baseCredit;

      return {
        id: r.id,
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
        voucherId: r.voucherId || '',
        voucherNo: '',
        description: r.description || '',
        debit,
        credit,
        balance: runningBalance,
        baseDebit: baseDebit || undefined,
        baseCredit: baseCredit || undefined,
        baseBalance: runningBaseBalance || undefined,
        currency: r.currency,
        fxAmount: debit || credit,
        exchangeRate: r.exchangeRate ?? 1.0,
      };
    });

    const closingBalance = openingBalance + totalDebit - totalCredit;
    const closingBalanceBase = openingBalance + totalBaseDebit - totalBaseCredit;

    return {
      accountId,
      accountCode: account?.userCode || '',
      accountName: account?.name || '',
      accountCurrency: account?.fixedCurrencyCode || company?.baseCurrency || 'USD',
      baseCurrency: company?.baseCurrency || 'USD',
      fromDate,
      toDate,
      openingBalance,
      openingBalanceBase: openingBalance,
      entries: statementEntries,
      closingBalance,
      closingBalanceBase,
      totalDebit,
      totalCredit,
      totalBaseDebit,
      totalBaseCredit,
    };
  }

  async getUnreconciledEntries(
    companyId: string,
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<LedgerEntry[]> {
    const where: any = {
      companyId,
      accountId,
      reconciliationId: null,
    };

    if (fromDate) {
      where.date = { ...(where.date || {}), gte: new Date(fromDate) };
    }
    if (toDate) {
      where.date = { ...(where.date || {}), lte: new Date(toDate) };
    }

    const records = await this.prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
    });

    return records.map((r) => this.toDomain(r));
  }

  async markReconciled(
    companyId: string,
    ledgerEntryId: string,
    reconciliationId: string,
    bankStatementLineId: string
  ): Promise<void> {
    await this.prisma.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: {
        reconciliationId,
        bankStatementLineId,
      } as any,
    });
  }

  async getForeignBalances(
    companyId: string,
    asOfDate: Date,
    accountIds?: string[]
  ): Promise<ForeignBalanceRow[]> {
    const where: any = {
      companyId,
      date: { lte: asOfDate },
    };

    if (accountIds && accountIds.length > 0) {
      where.accountId = { in: accountIds };
    }

    const entries = await this.prisma.ledgerEntry.findMany({
      where,
    });

    const balanceMap = new Map<string, { accountId: string; currency: string; foreignBalance: number; baseBalance: number }>();

    for (const entry of entries) {
      const key = `${entry.accountId}-${entry.currency}`;
      if (!balanceMap.has(key)) {
        balanceMap.set(key, {
          accountId: entry.accountId,
          currency: entry.currency,
          foreignBalance: 0,
          baseBalance: 0,
        });
      }
      const row = balanceMap.get(key)!;
      const amount = (entry as any).amount ?? 0;
      const baseAmount = (entry as any).baseAmount ?? 0;

      if (entry.debit > 0) {
        row.foreignBalance += amount;
        row.baseBalance += baseAmount;
      } else if (entry.credit > 0) {
        row.foreignBalance -= amount;
        row.baseBalance -= baseAmount;
      }
    }

    return Array.from(balanceMap.values()).map((row) => ({
      accountId: row.accountId,
      currency: row.currency,
      foreignBalance: row.foreignBalance,
      baseBalance: row.baseBalance,
    }));
  }
}
