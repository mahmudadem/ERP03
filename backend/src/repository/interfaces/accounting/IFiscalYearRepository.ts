import { FiscalYear } from '../../../domain/accounting/entities/FiscalYear';

export interface IFiscalYearRepository {
  findByCompany(companyId: string): Promise<FiscalYear[]>;
  findById(companyId: string, id: string): Promise<FiscalYear | null>;
  findActiveForDate(companyId: string, date: string): Promise<FiscalYear | null>;
  save(fiscalYear: FiscalYear): Promise<void>;
  update(fiscalYear: FiscalYear): Promise<void>;
}
