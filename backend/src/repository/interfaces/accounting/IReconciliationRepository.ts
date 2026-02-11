import { Reconciliation } from '../../../domain/accounting/entities/Reconciliation';

export interface IReconciliationRepository {
  save(reconciliation: Reconciliation): Promise<Reconciliation>;
  findLatestForAccount(companyId: string, accountId: string): Promise<Reconciliation | null>;
  list(companyId: string, accountId?: string): Promise<Reconciliation[]>;
  update(reconciliation: Reconciliation): Promise<void>;
}
