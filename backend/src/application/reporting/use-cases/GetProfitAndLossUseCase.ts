import { IVoucherRepository } from '../../../domain/accounting/repositories/IVoucherRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export interface ProfitAndLossInput {
  companyId: string;
  userId: string;
  fromDate: string;
  toDate: string;
}

export interface ProfitAndLossOutput {
  revenue: number;
  expenses: number;
  netProfit: number;
  revenueByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  expensesByAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  period: { from: string; to: string };
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const REPORT_VOUCHER_LIMIT = 100000;

const normalizeDateInput = (value: string): string => {
  if (DATE_ONLY_RE.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed.toISOString().slice(0, 10);
};

const classificationOf = (account: any): string => String(account?.classification || '').toUpperCase();

const accountLabel = (account: any, fallbackId: string): string => {
  const code = String(account?.userCode || account?.systemCode || '').trim();
  const name = String(account?.name || '').trim();
  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  return fallbackId;
};

export class GetProfitAndLossUseCase {
  constructor(
    private voucherRepository: IVoucherRepository,
    private accountRepository: IAccountRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(input: ProfitAndLossInput): Promise<ProfitAndLossOutput> {
    await this.permissionChecker.assertOrThrow(
      input.userId,
      input.companyId,
      'accounting.reports.profitAndLoss.view'
    );

    const fromDate = normalizeDateInput(input.fromDate);
    const toDate = normalizeDateInput(input.toDate);

    const [vouchers, accounts] = await Promise.all([
      this.voucherRepository.findByDateRange(input.companyId, fromDate, toDate, REPORT_VOUCHER_LIMIT),
      this.accountRepository.list(input.companyId),
    ]);

    const accountMap = new Map(accounts.map((account: any) => [account.id, account]));
    const postedVouchers = vouchers.filter((voucher) => voucher.isPosted);

    const revenueMap = new Map<string, { accountName: string; amount: number }>();
    const expenseMap = new Map<string, { accountName: string; amount: number }>();

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const voucher of postedVouchers) {
      for (const line of voucher.lines || []) {
        const accountId = line.accountId;
        const account = accountMap.get(accountId);
        const classification = classificationOf(account);

        if (classification === 'REVENUE') {
          const amount = (line.creditAmount || 0) - (line.debitAmount || 0);
          if (amount !== 0) {
            totalRevenue += amount;
            const existing = revenueMap.get(accountId) || {
              accountName: accountLabel(account, accountId),
              amount: 0,
            };
            existing.amount += amount;
            revenueMap.set(accountId, existing);
          }
        }

        if (classification === 'EXPENSE') {
          const amount = (line.debitAmount || 0) - (line.creditAmount || 0);
          if (amount !== 0) {
            totalExpenses += amount;
            const existing = expenseMap.get(accountId) || {
              accountName: accountLabel(account, accountId),
              amount: 0,
            };
            existing.amount += amount;
            expenseMap.set(accountId, existing);
          }
        }
      }
    }

    return {
      revenue: round2(totalRevenue),
      expenses: round2(totalExpenses),
      netProfit: round2(totalRevenue - totalExpenses),
      revenueByAccount: Array.from(revenueMap.entries())
        .map(([accountId, data]) => ({
          accountId,
          accountName: data.accountName,
          amount: round2(data.amount),
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      expensesByAccount: Array.from(expenseMap.entries())
        .map(([accountId, data]) => ({
          accountId,
          accountName: data.accountName,
          amount: round2(data.amount),
        }))
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      period: {
        from: fromDate,
        to: toDate,
      },
    };
  }
}
