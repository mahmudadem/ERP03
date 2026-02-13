import { ILedgerRepository, TrialBalanceRow, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { getDefaultBalanceNature } from '../../../domain/accounting/entities/Account';
import { PermissionChecker } from '../../rbac/PermissionChecker';

/**
 * DeleteVoucherLedgerUseCase
 * 
 * Removes ledger entries for a voucher.
 * CAUTION: Should only be used for corrections/unposting where allowed by policy.
 * Standard accounting practice prefers reversal entries.
 */
export class DeleteVoucherLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, voucherId: string) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.cancel');
    await this.ledgerRepo.deleteForVoucher(companyId, voucherId);
  }
}

/**
 * TrialBalanceLine — Phase 1 DTO for the official Trial Balance report.
 * Data source: Posted General Ledger only.
 */
export interface TrialBalanceLine {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  totalDebit: number;
  totalCredit: number;
  closingDebit: number;
  closingCredit: number;
  /** @deprecated Phase 2 — use closingDebit/closingCredit instead. Positive-by-nature for backward compat. */
  netBalance: number;
  parentId: string | null;
}

export interface TrialBalanceMeta {
  generatedAt: string;
  asOfDate: string;
  includeZeroBalance: boolean;
  totalClosingDebit: number;
  totalClosingCredit: number;
  difference: number;
  isBalanced: boolean;
}

export class GetTrialBalanceUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(
    companyId: string,
    userId: string,
    asOfDate: string,
    includeZeroBalance: boolean = false
  ): Promise<{ data: TrialBalanceLine[]; meta: TrialBalanceMeta }> {
    const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');

    const [rawTB, accounts] = await Promise.all([
      this.ledgerRepo.getTrialBalance(companyId, effectiveDate),
      this.accountRepo.list(companyId)
    ]);

    // Build account lookup
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

    // Build balance lookup from ledger
    const balanceMap = new Map<string, { debit: number; credit: number }>();
    rawTB.forEach((row) => {
      balanceMap.set(row.accountId, { debit: row.debit || 0, credit: row.credit || 0 });
    });

    // Enrich: join ledger data with COA — build ALL lines first
    const allLines: TrialBalanceLine[] = [];

    for (const account of accounts) {
      const bal = balanceMap.get(account.id) || { debit: 0, credit: 0 };
      const totalDebit = bal.debit;
      const totalCredit = bal.credit;

      const closingDebit = Math.max(0, totalDebit - totalCredit);
      const closingCredit = Math.max(0, totalCredit - totalDebit);

      // Legacy netBalance: positive-by-nature
      const classification = account.classification || 'EXPENSE';
      let netBalance: number;
      if (['ASSET', 'EXPENSE'].includes(classification)) {
        netBalance = totalDebit - totalCredit;
      } else {
        netBalance = totalCredit - totalDebit;
      }

      allLines.push({
        accountId: account.id,
        code: account.userCode || (account as any).code || '',
        name: account.name || '',
        classification,
        totalDebit,
        totalCredit,
        closingDebit,
        closingCredit,
        netBalance,
        parentId: account.parentId || null
      });
    }

    // Filter zero-balance accounts while preserving hierarchy ancestors
    let lines: TrialBalanceLine[];
    if (includeZeroBalance) {
      lines = allLines;
    } else {
      // Pass 1: find accounts with non-zero closing balances
      const needed = new Set<string>();
      for (const line of allLines) {
        if (line.closingDebit !== 0 || line.closingCredit !== 0) {
          needed.add(line.accountId);
          // Walk up the parentId chain to include all ancestors
          let pid = line.parentId;
          while (pid && !needed.has(pid)) {
            needed.add(pid);
            const parentAccount = accountMap.get(pid);
            pid = parentAccount?.parentId || null;
          }
        }
      }
      // Pass 2: keep only needed accounts
      lines = allLines.filter(l => needed.has(l.accountId));
    }

    // Sort by account code
    lines.sort((a, b) => a.code.localeCompare(b.code));

    // Compute meta
    const totalClosingDebit = lines.reduce((sum, r) => sum + r.closingDebit, 0);
    const totalClosingCredit = lines.reduce((sum, r) => sum + r.closingCredit, 0);
    const difference = totalClosingDebit - totalClosingCredit;

    return {
      data: lines,
      meta: {
        generatedAt: new Date().toISOString(),
        asOfDate: effectiveDate,
        includeZeroBalance,
        totalClosingDebit,
        totalClosingCredit,
        difference,
        isBalanced: Math.abs(difference) < 0.005
      }
    };
  }
}

export class GetGeneralLedgerUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}

export class GetAccountStatementUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, accountId: string, fromDate: string, toDate: string, options?: { includeUnposted?: boolean }) {
    if (!accountId) {
      throw new Error('accountId is required');
    }
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    return this.ledgerRepo.getAccountStatement(companyId, accountId, fromDate, toDate, options);
  }
}

export interface BalanceSheetLine {
  accountId: string;
  code: string;
  name: string;
  parentId?: string | null;
  level: number;
  balance: number;
  isParent: boolean;
}

export interface BalanceSheetSection {
  accounts: BalanceSheetLine[];
  total: number;
}

export interface BalanceSheetData {
  asOfDate: string;
  baseCurrency: string;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  retainedEarnings: number;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

export class GetBalanceSheetUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private permissionChecker: PermissionChecker,
    private companyRepo?: ICompanyRepository
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<BalanceSheetData> {
    const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.balanceSheet.view');

    const [trialBalance, accounts, company] = await Promise.all([
      this.ledgerRepo.getTrialBalance(companyId, effectiveDate),
      this.accountRepo.list(companyId),
      this.companyRepo?.findById(companyId).catch(() => null)
    ]);

    const balanceMap = new Map<string, { debit: number; credit: number }>();
    trialBalance.forEach((row) => {
      balanceMap.set(row.accountId, {
        debit: row.debit || 0,
        credit: row.credit || 0
      });
    });

    const getNetBalance = (account: any) => {
      const entry = balanceMap.get(account.id) || { debit: 0, credit: 0 };
      const debit = entry.debit || 0;
      const credit = entry.credit || 0;
      const nature = account.balanceNature || getDefaultBalanceNature(account.classification);

      if (nature === 'CREDIT') {
        return credit - debit;
      }
      if (nature === 'DEBIT') {
        return debit - credit;
      }
      // BOTH: fall back to classification direction
      return ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.classification)
        ? credit - debit
        : debit - credit;
    };

    const buildSection = (classification: string): BalanceSheetSection => {
      const relevantAccounts = accounts.filter((a) => a.classification === classification);
      const allowedParents = new Set(relevantAccounts.map((a) => a.id));
      const childrenMap = new Map<string | null, typeof relevantAccounts>();

      relevantAccounts.forEach((acc) => {
        const parentKey = acc.parentId && allowedParents.has(acc.parentId) ? acc.parentId : null;
        const bucket = childrenMap.get(parentKey) || [];
        bucket.push(acc);
        childrenMap.set(parentKey, bucket);
      });

      const sortAccounts = (a: any, b: any) => (a.userCode || '').localeCompare(b.userCode || '');

      const traverse = (
        parentId: string | null,
        level: number
      ): { lines: BalanceSheetLine[]; subtotal: number } => {
        const siblings = (childrenMap.get(parentId) || []).sort(sortAccounts);
        let subtotal = 0;
        const lines: BalanceSheetLine[] = [];

        siblings.forEach((acc) => {
          const childResult = traverse(acc.id, level + 1);
          const ownBalance = getNetBalance(acc);
          const balance = ownBalance + childResult.subtotal;
          const line: BalanceSheetLine = {
            accountId: acc.id,
            code: acc.userCode || (acc as any).code || '',
            name: acc.name,
            parentId,
            level,
            balance,
            isParent: childResult.lines.length > 0 || acc.accountRole === 'HEADER' || (acc as any).hasChildren === true
          };
          lines.push(line, ...childResult.lines);
          subtotal += balance;
        });

        return { lines, subtotal };
      };

      const { lines, subtotal } = traverse(null, 0);
      return { accounts: lines, total: subtotal };
    };

    const assets = buildSection('ASSET');
    const liabilities = buildSection('LIABILITY');
    const equity = buildSection('EQUITY');

    const revenueTotal = accounts
      .filter((a) => a.classification === 'REVENUE')
      .reduce((sum, acc) => sum + getNetBalance(acc), 0);

    const expenseTotal = accounts
      .filter((a) => a.classification === 'EXPENSE')
      .reduce((sum, acc) => sum + getNetBalance(acc), 0);

    const retainedEarnings = revenueTotal - expenseTotal;

    const retainedLine: BalanceSheetLine = {
      accountId: 'retained-earnings',
      code: 'RE',
      name: 'Retained Earnings',
      parentId: null,
      level: 0,
      balance: retainedEarnings,
      isParent: false
    };

    equity.accounts = [...equity.accounts, retainedLine];
    equity.total += retainedEarnings;

    const totalAssets = assets.total;
    const totalLiabilitiesAndEquity = liabilities.total + equity.total;

    return {
      asOfDate: effectiveDate,
      baseCurrency: (company as any)?.baseCurrency || '',
      assets,
      liabilities,
      equity,
      retainedEarnings,
      totalAssets,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01
    };
  }
}

export class GetJournalUseCase {
  constructor(
    private voucherRepo: any,
    private accountRepo: any,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));

    const vouchers = await this.voucherRepo.findByDateRange(
      companyId,
      (filters as any).fromDate || '1900-01-01',
      (filters as any).toDate || new Date().toISOString().split('T')[0]
    );
    const filtered = (filters as any).voucherType
      ? vouchers.filter((v: any) => (v.type || '').toString() === (filters as any).voucherType)
      : vouchers;

    return filtered.map((v: any) => {
      const lines = (v.lines || []).map((l: any) => {
        const acc = accountMap.get(l.accountId) as any;
        return {
          accountId: l.accountId,
          accountCode: acc?.userCode || acc?.code || l.accountId,
          accountName: acc?.name || 'Unknown',
          description: l.notes || l.description || '',
          debit: l.debitAmount || 0,
          credit: l.creditAmount || 0,
          currency: l.currency,
          exchangeRate: l.exchangeRate
        };
      });
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      return {
        voucherId: v.id,
        voucherNo: v.voucherNo || v.id,
        date: v.date,
        type: v.type,
        description: v.description,
        status: v.status,
        currency: v.currency,
        lines,
        totalDebit,
        totalCredit
      };
    });
  }
}
