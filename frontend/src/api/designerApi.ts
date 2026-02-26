
/**
 * designerApi.ts
 */
import client from './client';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';

export const designerApi = {
  getVoucherTypeByCode: (code: string): Promise<VoucherTypeDefinition> => {
    return client.get(`/tenant/accounting/designer/voucher-types/${code}`, {
      headers: { 'X-Silent-Error': 'true' }
    });
  },

  listVoucherTypes: (): Promise<{id: string, code: string, name: string}[]> => {
    return client.get('/tenant/accounting/designer/voucher-types');
  }
};

