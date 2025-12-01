
/**
 * designerApi.ts
 */
import client from './client';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';

export const designerApi = {
  getVoucherTypeByCode: (code: string): Promise<VoucherTypeDefinition> => {
    return client.get(`/designer/voucher-types/${code}`);
  },

  listVoucherTypes: (): Promise<{id: string, code: string, name: string}[]> => {
    return client.get('/designer/voucher-types');
  }
};

