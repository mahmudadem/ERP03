import { v4 as uuidv4 } from 'uuid';
import { ICompanyGroupRepository } from '../../../repository/interfaces/accounting/ICompanyGroupRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';
import { ILedgerRepository, TrialBalanceRow } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting/IAccountRepository';
import { IExchangeRateRepository } from '../../../repository/interfaces/accounting/IExchangeRateRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export interface ConsolidatedTrialBalance {
  groupId: string;
  reportingCurrency: string;
  asOfDate: string;
  lines: TrialBalanceRow[];
  totals: { debit: number; credit: number; balance: number };
}

export class GetConsolidatedTrialBalanceUseCase {
  constructor(
    private groupRepo: ICompanyGroupRepository,
    private companyRepo: ICompanyRepository,
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private rateRepo: IExchangeRateRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(groupId: string, companyId: string, userId: string, asOfDate: string): Promise<ConsolidatedTrialBalance> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    const group = await this.groupRepo.findById(groupId);
    if (!group) throw new Error('Group not found');

    const memberCompanies = await Promise.all(group.members.map((m) => this.companyRepo.findById(m.companyId)));
    const reportingCurrency = group.reportingCurrency.toUpperCase();

    const linesMap: Record<string, TrialBalanceRow> = {};

    for (const member of memberCompanies) {
      if (!member) continue;
      const tb = await this.ledgerRepo.getTrialBalance(member.id, asOfDate);
      const baseCurrency = (member as any).baseCurrency?.toUpperCase() || reportingCurrency;
      const fx = baseCurrency === reportingCurrency ? 1 : await this.getRate(member.id, baseCurrency, reportingCurrency, asOfDate);

      tb.forEach((row) => {
        const key = row.accountId;
        const debit = row.debit * fx;
        const credit = row.credit * fx;
        if (!linesMap[key]) {
          linesMap[key] = { ...row, debit, credit };
        } else {
          linesMap[key].debit += debit;
          linesMap[key].credit += credit;
        }
      });
    }

    // compute balances
    const lines = Object.values(linesMap).map((r) => ({ ...r, balance: (r.debit || 0) - (r.credit || 0) }));
    const totals = lines.reduce(
      (acc, r) => ({
        debit: acc.debit + (r.debit || 0),
        credit: acc.credit + (r.credit || 0),
        balance: acc.balance + (r.balance || 0)
      }),
      { debit: 0, credit: 0, balance: 0 }
    );

    return {
      groupId,
      reportingCurrency,
      asOfDate,
      lines,
      totals
    };
  }

  private async getRate(companyId: string, from: string, to: string, date: string): Promise<number> {
    const rate = await this.rateRepo.getMostRecentRateBeforeDate(companyId, from, to, new Date(date));
    if (!rate) throw new Error(`Missing FX rate ${from}->${to} for ${date}`);
    return rate.rate;
  }
}
