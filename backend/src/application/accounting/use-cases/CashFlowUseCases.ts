import { PermissionChecker } from '../../rbac/PermissionChecker';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

interface CashFlowItem {
  name: string;
  amount: number;
  accountId?: string;
}

export interface CashFlowSection {
  items: CashFlowItem[];
  total: number;
}

export interface CashFlowData {
  period: { from: string; to: string };
  baseCurrency: string;
  netIncome: number;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netCashChange: number;
  openingCashBalance: number;
  closingCashBalance: number;
}

const iso = (d: Date) => d.toISOString().split('T')[0];

export class GetCashFlowStatementUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private companyRepo: ICompanyRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, fromDate: string, toDate: string): Promise<CashFlowData> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.cashFlow.view');

    const effectiveFrom = fromDate || iso(new Date(new Date().getFullYear(), 0, 1));
    const effectiveTo = toDate || iso(new Date());

    const accounts = await this.accountRepo.list(companyId);
    const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
    const company = await this.companyRepo.findById(companyId).catch(() => null as any);
    const baseCurrency = (company as any)?.baseCurrency || '';

    // Trial balance at start-1 and at end
    const openingDate = (() => {
      const d = new Date(effectiveFrom);
      d.setDate(d.getDate() - 1);
      return iso(d);
    })();
    const openingTB = await this.ledgerRepo.getTrialBalance(companyId, openingDate);
    const closingTB = await this.ledgerRepo.getTrialBalance(companyId, effectiveTo);
    const tbMap = (tb: any[]) => {
      const m = new Map<string, { debit: number; credit: number }>();
      tb.forEach((r) => m.set(r.accountId, { debit: r.debit || 0, credit: r.credit || 0 }));
      return m;
    };
    const openMap = tbMap(openingTB);
    const closeMap = tbMap(closingTB);

    const isCash = (acc: any) => ['CASH', 'BANK'].includes((acc?.accountRole || '').toUpperCase());
    const cashIds = accounts.filter(isCash).map((a: any) => a.id);

    const balanceOf = (map: Map<string, { debit: number; credit: number }>, accId: string, cls: string) => {
      const v = map.get(accId);
      if (!v) return 0;
      return ['ASSET', 'EXPENSE'].includes(cls) ? (v.debit - v.credit) : (v.credit - v.debit);
    };

    const openingCashBalance = cashIds.reduce((s, id) => {
      const acc = accountMap.get(id);
      return s + balanceOf(openMap, id, acc?.classification || 'ASSET');
    }, 0);
    const closingCashBalance = cashIds.reduce((s, id) => {
      const acc = accountMap.get(id);
      return s + balanceOf(closeMap, id, acc?.classification || 'ASSET');
    }, 0);
    const netCashChange = closingCashBalance - openingCashBalance;

    // Net income: delta of revenue/expense accounts
    let netIncome = 0;
    accounts.forEach((acc: any) => {
      if (['REVENUE', 'EXPENSE'].includes(acc.classification)) {
        const delta = balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
        netIncome += acc.classification === 'REVENUE' ? delta : -delta;
      }
    });

    // Working capital change (current assets/liabilities excluding cash/bank)
    let workingCapitalChange = 0;
    accounts.forEach((acc: any) => {
      if (cashIds.includes(acc.id)) return;
      const delta = balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
      if (['ASSET'].includes(acc.classification)) {
        workingCapitalChange -= delta; // increase in asset reduces cash
      } else if (['LIABILITY'].includes(acc.classification)) {
        workingCapitalChange += delta; // increase in liability increases cash
      }
    });

    const operatingTotal = netIncome + workingCapitalChange;

    const operating: CashFlowSection = {
      items: [
        { name: 'Net Income', amount: netIncome },
        { name: 'Working Capital Changes', amount: workingCapitalChange }
      ],
      total: operatingTotal
    };

    const investing: CashFlowSection = { items: [], total: 0 };
    const financing: CashFlowSection = { items: [], total: 0 };

    return {
      period: { from: effectiveFrom, to: effectiveTo },
      baseCurrency,
      netIncome,
      operating,
      investing,
      financing,
      netCashChange,
      openingCashBalance,
      closingCashBalance
    };
  }
}
