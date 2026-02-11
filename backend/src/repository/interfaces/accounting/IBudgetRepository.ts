import { Budget, BudgetStatus } from '../../../domain/accounting/entities/Budget';

export interface IBudgetRepository {
  create(budget: Budget): Promise<Budget>;
  update(budget: Budget): Promise<Budget>;
  findById(companyId: string, id: string): Promise<Budget | null>;
  list(companyId: string, fiscalYearId?: string): Promise<Budget[]>;
  setStatus(companyId: string, id: string, status: BudgetStatus): Promise<void>;
}
