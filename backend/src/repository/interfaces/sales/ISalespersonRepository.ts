import { Salesperson } from '../../../domain/sales/entities/Salesperson';

export interface SalespersonListOptions {
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ISalespersonRepository {
  create(salesperson: Salesperson, transaction?: unknown): Promise<void>;
  update(salesperson: Salesperson, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<Salesperson | null>;
  getByCode(companyId: string, code: string): Promise<Salesperson | null>;
  list(companyId: string, opts?: SalespersonListOptions): Promise<Salesperson[]>;
  delete(companyId: string, id: string): Promise<void>;
}
