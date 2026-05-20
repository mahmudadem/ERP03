import { CustomerGroup } from '../../../domain/sales/entities/CustomerGroup';

export interface CustomerGroupListOptions {
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface ICustomerGroupRepository {
  create(group: CustomerGroup, transaction?: unknown): Promise<void>;
  update(group: CustomerGroup, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<CustomerGroup | null>;
  getByName(companyId: string, name: string): Promise<CustomerGroup | null>;
  list(companyId: string, opts?: CustomerGroupListOptions): Promise<CustomerGroup[]>;
  delete(companyId: string, id: string): Promise<void>;
}
