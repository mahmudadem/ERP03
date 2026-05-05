
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
  },

  adoptTemplate: (companyId: string, userId: string, templateId: string, module: string): Promise<{ formId: string; voucherTypeId: string }> => {
    return client.post('/tenant/accounting/designer/adopt-template', {
      companyId,
      userId,
      templateId,
      module
    });
  }
};

