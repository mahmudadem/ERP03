import client from '../../../../api/client';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';

export interface IVoucherTypeRepository {
  get(code: string): Promise<VoucherTypeDefinition>;
  create(definition: VoucherTypeDefinition): Promise<VoucherTypeDefinition>;
  update(code: string, definition: VoucherTypeDefinition): Promise<void>;
  list(): Promise<VoucherTypeDefinition[]>;
}

export class VoucherTypeRepository implements IVoucherTypeRepository {
  async get(code: string): Promise<VoucherTypeDefinition> {
    return client.get(`/tenant/accounting/designer/voucher-types/${code}`);
  }

  async create(definition: VoucherTypeDefinition): Promise<VoucherTypeDefinition> {
    return client.post('/tenant/accounting/designer/voucher-types', definition);
  }

  async update(code: string, definition: VoucherTypeDefinition): Promise<void> {
    return client.put(`/tenant/accounting/designer/voucher-types/${code}`, definition);
  }

  async list(): Promise<VoucherTypeDefinition[]> {
    return client.get('/tenant/accounting/designer/voucher-types');
  }
}

export const voucherTypeRepository = new VoucherTypeRepository();
