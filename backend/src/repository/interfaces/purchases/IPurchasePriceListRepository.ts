import { PurchasePriceList } from '../../../domain/purchases/entities/PurchasePriceList';

export interface PurchasePriceListListOptions {
  currency?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface IPurchasePriceListRepository {
  create(list: PurchasePriceList, transaction?: unknown): Promise<void>;
  update(list: PurchasePriceList, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<PurchasePriceList | null>;
  getByName(companyId: string, name: string): Promise<PurchasePriceList | null>;
  list(companyId: string, opts?: PurchasePriceListListOptions): Promise<PurchasePriceList[]>;
  getDefaultForCurrency(companyId: string, currency: string): Promise<PurchasePriceList | null>;
  delete(companyId: string, id: string): Promise<void>;
}
