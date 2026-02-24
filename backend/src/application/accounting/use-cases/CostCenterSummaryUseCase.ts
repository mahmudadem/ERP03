
import { ILedgerRepository, GLFilters } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../repository/interfaces/accounting';
import { ICostCenterRepository } from '../../../repository/interfaces/accounting/ICostCenterRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';

export interface CostCenterSummaryFilters {
  costCenterId: string;
  fromDate?: string;
  toDate?: string;
}

export interface CostCenterSummaryRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  classification: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

export interface CostCenterSummaryResult {
  rows: CostCenterSummaryRow[];
  meta: {
    costCenterId: string;
    costCenterCode: string;
    costCenterName: string;
    fromDate?: string;
    toDate?: string;
    totalDebit: number;
    totalCredit: number;
    netBalance: number;
  };
}

export class GetCostCenterSummaryUseCase {
  constructor(
    private ledgerRepo: ILedgerRepository,
    private accountRepo: IAccountRepository,
    private costCenterRepo: ICostCenterRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, filters: CostCenterSummaryFilters): Promise<CostCenterSummaryResult> {
    // RBAC
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');

    // 1. Resolve cost center
    const cc = await this.costCenterRepo.findById(companyId, filters.costCenterId);
    if (!cc) {
      throw new Error(`Cost center not found: ${filters.costCenterId}`);
    }

    // 2. Fetch all ledger entries for this cost center
    const glFilters: GLFilters = {
      costCenterId: filters.costCenterId,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
    };
    const entries = await this.ledgerRepo.getGeneralLedger(companyId, glFilters);

    // 3. Aggregate by accountId
    const aggregates = new Map<string, { debit: number; credit: number }>();
    for (const entry of entries) {
      const existing = aggregates.get(entry.accountId) || { debit: 0, credit: 0 };
      existing.debit += entry.debit || 0;
      existing.credit += entry.credit || 0;
      aggregates.set(entry.accountId, existing);
    }

    // 4. Enrich with account data
    const accounts = this.accountRepo.getAccounts
      ? await this.accountRepo.getAccounts(companyId)
      : await this.accountRepo.list(companyId);
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    // 5. Build rows
    const rows: CostCenterSummaryRow[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const [accountId, totals] of aggregates.entries()) {
      const acc = accountMap.get(accountId);
      const row: CostCenterSummaryRow = {
        accountId,
        accountCode: acc?.code || acc?.userCode || '???',
        accountName: acc?.name || 'Unknown Account',
        classification: (acc as any)?.classification || '',
        totalDebit: totals.debit,
        totalCredit: totals.credit,
        netBalance: totals.debit - totals.credit,
      };
      totalDebit += totals.debit;
      totalCredit += totals.credit;
      rows.push(row);
    }

    // Sort by account code
    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      rows,
      meta: {
        costCenterId: cc.id,
        costCenterCode: cc.code,
        costCenterName: cc.name,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        totalDebit,
        totalCredit,
        netBalance: totalDebit - totalCredit,
      },
    };
  }
}
