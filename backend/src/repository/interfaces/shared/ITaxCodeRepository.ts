import { TaxCode, TaxScope } from '../../../domain/shared/entities/TaxCode';

export interface TaxCodeListOptions {
  scope?: TaxScope;
  active?: boolean;
  limit?: number;
  offset?: number;
}

export interface ITaxCodeRepository {
  create(taxCode: TaxCode): Promise<void>;
  update(taxCode: TaxCode): Promise<void>;
  getById(companyId: string, id: string): Promise<TaxCode | null>;
  getByCode(companyId: string, code: string): Promise<TaxCode | null>;
  list(companyId: string, opts?: TaxCodeListOptions): Promise<TaxCode[]>;
}
