import { PermissionChecker } from '../../rbac/PermissionChecker';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { isCashLikeAccount } from '../utils/cashAccountMatcher';

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
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const isNonZero = (value: number) => Math.abs(value) >= 0.005;

type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING';

const INVESTING_HINTS = [
  'property',
  'plant',
  'equipment',
  'ppe',
  'building',
  'land',
  'vehicle',
  'machinery',
  'intangible',
  'investment',
  'capital work',
  'capex',
];

const FINANCING_HINTS = [
  'loan',
  'debt',
  'borrow',
  'bond',
  'mortgage',
  'lease liability',
  'notes payable',
  'capital',
  'share',
  'equity',
  'owner',
  'partner',
  'dividend',
];

const RETAINED_EARNINGS_HINTS = ['retained earnings', 'retained earning', 'current year earnings'];
const NON_CASH_PNL_HINTS = ['depreciation', 'amortization', 'impairment', 'provision', 'unrealized', 'accrual'];

const normalizeText = (account: any) =>
  `${account?.name || ''} ${account?.userCode || ''} ${account?.systemCode || ''}`.toLowerCase();

const inferCashFlowCategory = (account: any): CashFlowCategory => {
  const explicit = String(account?.cashFlowCategory || '').toUpperCase();
  if (explicit === 'OPERATING' || explicit === 'INVESTING' || explicit === 'FINANCING') {
    return explicit as CashFlowCategory;
  }

  const classification = String(account?.classification || '').toUpperCase();
  const text = normalizeText(account);

  if (classification === 'ASSET') {
    if (INVESTING_HINTS.some((hint) => text.includes(hint))) return 'INVESTING';
    return 'OPERATING';
  }

  if (classification === 'LIABILITY') {
    if (FINANCING_HINTS.some((hint) => text.includes(hint))) return 'FINANCING';
    return 'OPERATING';
  }

  if (classification === 'EQUITY') {
    if (RETAINED_EARNINGS_HINTS.some((hint) => text.includes(hint))) return 'OPERATING';
    return 'FINANCING';
  }

  return 'OPERATING';
};

const isLikelyNonCashPnl = (account: any) => {
  const text = normalizeText(account);
  return NON_CASH_PNL_HINTS.some((hint) => text.includes(hint));
};

const cashEffectFromDelta = (classification: string, delta: number): number => {
  const cls = String(classification || '').toUpperCase();
  if (cls === 'ASSET' || cls === 'EXPENSE') return -delta;
  return delta;
};

const accountLabel = (account: any) => {
  const code = (account?.userCode || account?.systemCode || '').trim();
  const name = (account?.name || 'Account').trim();
  return code ? `${code} - ${name}` : name;
};

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

    const cashIds = new Set(accounts.filter((acc: any) => isCashLikeAccount(acc)).map((a: any) => a.id));

    const balanceOf = (map: Map<string, { debit: number; credit: number }>, accId: string, cls: string) => {
      const v = map.get(accId);
      if (!v) return 0;
      return ['ASSET', 'EXPENSE'].includes(cls) ? (v.debit - v.credit) : (v.credit - v.debit);
    };

    const openingCashBalance = Array.from(cashIds).reduce((s, id) => {
      const acc = accountMap.get(id);
      return s + balanceOf(openMap, id, acc?.classification || 'ASSET');
    }, 0);
    const closingCashBalance = Array.from(cashIds).reduce((s, id) => {
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

    const movementRows = accounts
      .filter((acc: any) => !cashIds.has(acc.id))
      .map((acc: any) => {
        const delta =
          balanceOf(closeMap, acc.id, acc.classification) - balanceOf(openMap, acc.id, acc.classification);
        return {
          account: acc,
          delta,
          cashEffect: cashEffectFromDelta(acc.classification, delta),
          category: inferCashFlowCategory(acc),
        };
      })
      .filter((row) => isNonZero(row.delta) || isNonZero(row.cashEffect));

    const sectionFromCategory = (category: CashFlowCategory): CashFlowSection => {
      const rows = movementRows.filter((row) => row.category === category && isNonZero(row.cashEffect));
      const total = rows.reduce((sum, row) => sum + row.cashEffect, 0);
      const items = rows
        .sort((a, b) => Math.abs(b.cashEffect) - Math.abs(a.cashEffect))
        .map((row) => ({
          name: accountLabel(row.account),
          amount: round2(row.cashEffect),
          accountId: row.account.id,
        }));
      return { items, total: round2(total) };
    };

    const investing = sectionFromCategory('INVESTING');
    const financing = sectionFromCategory('FINANCING');

    const roundedNetCashChange = round2(netCashChange);
    const operatingTarget = round2(roundedNetCashChange - investing.total - financing.total);
    const operatingRows = movementRows.filter((row) => row.category === 'OPERATING');

    const workingCapitalChange = operatingRows
      .filter((row) => ['ASSET', 'LIABILITY'].includes(String(row.account.classification || '').toUpperCase()))
      .reduce((sum, row) => sum + row.cashEffect, 0);

    const nonCashAdjustments = operatingRows
      .filter(
        (row) =>
          ['REVENUE', 'EXPENSE'].includes(String(row.account.classification || '').toUpperCase()) &&
          isLikelyNonCashPnl(row.account)
      )
      .reduce((sum, row) => sum - row.cashEffect, 0);

    const operatingItems: CashFlowItem[] = [{ name: 'Net Income', amount: round2(netIncome) }];
    if (isNonZero(nonCashAdjustments)) {
      operatingItems.push({ name: 'Non-Cash Adjustments', amount: round2(nonCashAdjustments) });
    }
    operatingItems.push({ name: 'Working Capital Changes', amount: round2(workingCapitalChange) });

    const derivedOperating =
      (operatingItems[0]?.amount || 0) +
      (operatingItems.find((i) => i.name === 'Non-Cash Adjustments')?.amount || 0) +
      (operatingItems.find((i) => i.name === 'Working Capital Changes')?.amount || 0);
    const otherOperating = operatingTarget - derivedOperating;
    if (isNonZero(otherOperating)) {
      operatingItems.push({ name: 'Other Operating Movements', amount: round2(otherOperating) });
    }

    const operating: CashFlowSection = {
      items: operatingItems,
      total: round2(operatingTarget),
    };

    return {
      period: { from: effectiveFrom, to: effectiveTo },
      baseCurrency,
      netIncome: round2(netIncome),
      operating,
      investing,
      financing,
      netCashChange: roundedNetCashChange,
      openingCashBalance: round2(openingCashBalance),
      closingCashBalance: round2(closingCashBalance),
    };
  }
}
