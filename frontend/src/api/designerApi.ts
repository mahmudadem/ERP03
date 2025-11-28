
/**
 * designerApi.ts
 */
import { httpClient } from './httpClient';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';

export const designerApi = {
  getVoucherTypeByCode: async (code: string) => {
    return httpClient<VoucherTypeDefinition>(`/designer/voucher-types/${code}`);
  },

  listVoucherTypes: async () => {
    return httpClient<{id: string, code: string, name: string}[]>('/designer/voucher-types');
  }
};
