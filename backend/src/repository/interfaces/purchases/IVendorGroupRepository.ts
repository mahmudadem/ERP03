import { VendorGroup } from '../../../domain/purchases/entities/VendorGroup';

export interface VendorGroupListOptions {
  status?: 'ACTIVE' | 'INACTIVE';
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface IVendorGroupRepository {
  create(group: VendorGroup, transaction?: unknown): Promise<void>;
  update(group: VendorGroup, transaction?: unknown): Promise<void>;
  getById(companyId: string, id: string): Promise<VendorGroup | null>;
  getByName(companyId: string, name: string): Promise<VendorGroup | null>;
  list(companyId: string, opts?: VendorGroupListOptions): Promise<VendorGroup[]>;
  delete(companyId: string, id: string): Promise<void>;
}
