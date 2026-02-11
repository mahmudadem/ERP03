import { v4 as uuidv4 } from 'uuid';
import { Budget, BudgetLine, BudgetStatus } from '../../../domain/accounting/entities/Budget';
import { IBudgetRepository } from '../../../repository/interfaces/accounting/IBudgetRepository';
import { IFiscalYearRepository } from '../../../repository/interfaces/accounting/IFiscalYearRepository';
import { ILedgerRepository } from '../../../repository/interfaces/accounting/ILedgerRepository';
import { PermissionChecker } from '../../rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

export interface CreateBudgetInput {
  fiscalYearId: string;
  name: string;
  version?: number;
  lines: BudgetLine[];
}

export class CreateBudgetUseCase {
  constructor(private repo: IBudgetRepository, private fiscalYears: IFiscalYearRepository, private permissionChecker: PermissionChecker) {}

  async execute(companyId: string, userId: string, input: CreateBudgetInput): Promise<Budget> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const fy = await this.fiscalYears.findById(companyId, input.fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');
    const now = new Date();
    const budget = new Budget(
      uuidv4(),
      companyId,
      input.fiscalYearId,
      input.name,
      input.version ?? 1,
      'DRAFT',
      input.lines,
      now,
      userId,
      now,
      userId
    );
    return this.repo.create(budget);
  }
}

export class UpdateBudgetUseCase {
  constructor(private repo: IBudgetRepository, private permissionChecker: PermissionChecker) {}

  async execute(companyId: string, userId: string, budgetId: string, payload: Partial<CreateBudgetInput>): Promise<Budget> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const existing = await this.repo.findById(companyId, budgetId);
    if (!existing) throw new Error('Budget not found');
    if (existing.status !== 'DRAFT') throw new Error('Only DRAFT budgets can be updated');

    const lines = payload.lines || existing.lines;
    const budget = new Budget(
      existing.id,
      companyId,
      payload.fiscalYearId || existing.fiscalYearId,
      payload.name || existing.name,
      payload.version ?? existing.version,
      existing.status,
      lines,
      existing.createdAt,
      existing.createdBy,
      new Date(),
      userId
    );
    return this.repo.update(budget);
  }
}

export class ApproveBudgetUseCase {
  constructor(private repo: IBudgetRepository, private permissionChecker: PermissionChecker) {}

  async execute(companyId: string, userId: string, budgetId: string): Promise<void> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.settings.write');
    const budget = await this.repo.findById(companyId, budgetId);
    if (!budget) throw new Error('Budget not found');
    await this.repo.setStatus(companyId, budgetId, 'APPROVED');
  }
}

export interface BudgetVsActualLine {
  accountId: string;
  costCenterId?: string;
  budget: number;
  actual: number;
  variance: number;
  variancePct: number;
}

export class GetBudgetVsActualUseCase {
  constructor(
    private budgets: IBudgetRepository,
    private fiscalYears: IFiscalYearRepository,
    private ledger: ILedgerRepository,
    private permissionChecker: PermissionChecker
  ) {}

  async execute(companyId: string, userId: string, budgetId: string, costCenterId?: string): Promise<BudgetVsActualLine[]> {
    await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
    const budget = await this.budgets.findById(companyId, budgetId);
    if (!budget) throw new Error('Budget not found');
    const fy = await this.fiscalYears.findById(companyId, budget.fiscalYearId);
    if (!fy) throw new Error('Fiscal year not found');
    const start = fy.startDate;
    const end = fy.endDate;

    // Get actual ledger entries for range
    const ledgerEntries = await this.ledger.getGeneralLedger(companyId, { fromDate: start, toDate: end });
    const actualMap = new Map<string, number>();
    ledgerEntries.forEach((e) => {
      if (costCenterId && e.costCenterId !== costCenterId) return;
      const key = `${e.accountId}${e.costCenterId || ''}`;
      const signed = (e.side || 'Debit') === 'Debit' ? e.amount : -e.amount;
      actualMap.set(key, (actualMap.get(key) || 0) + signed);
    });

    return budget.lines
      .filter((l) => !costCenterId || l.costCenterId === costCenterId)
      .map((line) => {
        const key = `${line.accountId}${line.costCenterId || ''}`;
        const actual = actualMap.get(key) || 0;
        const variance = actual - line.annualTotal;
        const variancePct = line.annualTotal === 0 ? 0 : (variance / line.annualTotal) * 100;
        return {
          accountId: line.accountId,
          costCenterId: line.costCenterId,
          budget: line.annualTotal,
          actual,
          variance,
          variancePct
        };
      });
  }
}
