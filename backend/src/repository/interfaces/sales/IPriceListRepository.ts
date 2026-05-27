import { PriceList } from '../../../domain/sales/entities/PriceList';

export interface PriceListListOptions {
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface IPriceListRepository {
  create(list: PriceList, transaction?: unknown): Promise<void>;
  update(list: PriceList, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PriceList | null>;
  getByName(companyId: string, name: string): Promise<PriceList | null>;
  list(companyId: string, opts?: PriceListListOptions): Promise<PriceList[]>;
  getDefaultForCurrency(companyId: string, currency: string): Promise<PriceList | null>;
  delete(companyId: string, id: string): Promise<void>;
}
