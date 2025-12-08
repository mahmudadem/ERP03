import { client } from '../client';
import { VoucherTypeDefinition } from '../../designer-engine/types/VoucherTypeDefinition';

const BASE_URL = '/super-admin/voucher-types';

export const superAdminVoucherTypesApi = {
  list: async (): Promise<VoucherTypeDefinition[]> => {
    const res = await client.get(BASE_URL);
    return res as any;
  },

  create: async (data: Partial<VoucherTypeDefinition>): Promise<VoucherTypeDefinition> => {
    const res = await client.post(BASE_URL, data);
    return res as any;
  },

  update: async (id: string, data: Partial<VoucherTypeDefinition>): Promise<void> => {
    await client.put(`${BASE_URL}/${id}`, data);
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`${BASE_URL}/${id}`);
  }
};
