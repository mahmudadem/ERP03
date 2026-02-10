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

export class GetTrialBalanceUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, asOfDate: string): Promise<TrialBalanceRow[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.trialBalance.view');
    return this.ledgerRepo.getTrialBalance(companyId, asOfDate);
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
    private ledgerRepo: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: GLFilters) {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.view');
    return this.ledgerRepo.getGeneralLedger(companyId, filters);
  }
}
