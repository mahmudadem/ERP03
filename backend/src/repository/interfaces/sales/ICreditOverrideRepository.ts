import { CreditOverride } from '../../../domain/sales/entities/CreditOverride';

export interface CreditOverrideListOptions {
  customerId?: string;
  sourceId?: string;
  limit?: number;
  offset?: number;
}

export interface ICreditOverrideRepository {
  create(override: CreditOverride, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<CreditOverride | null>;
  list(companyId: string, opts?: CreditOverrideListOptions): Promise<CreditOverride[]>;
}
