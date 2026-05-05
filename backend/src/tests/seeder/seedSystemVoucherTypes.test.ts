import { describe, expect, it, jest } from '@jest/globals';
import { VoucherTypeDefinition } from '../../domain/designer/entities/VoucherTypeDefinition';
import { seedSystemVoucherTypes } from '../../seeder/seedSystemVoucherTypes';

const makeRepo = () => {
  const stored: any[] = [];

  return {
    stored,
    repo: {
      createVoucherType: jest.fn(async (definition: VoucherTypeDefinition) => {
        stored.push(definition);
      }),
      updateVoucherType: jest.fn(async (_companyId: string, _id: string, data: Partial<VoucherTypeDefinition>) => {
        stored.push(data);
      }),
      getVoucherType: jest.fn(),
      getVoucherTypesForModule: jest.fn(),
      getByCompanyId: jest.fn(),
      getByCode: jest.fn(),
      updateLayout: jest.fn(),
      getSystemTemplates: jest.fn(async () => []),
      deleteVoucherType: jest.fn(),
    },
  };
};

describe('seedSystemVoucherTypes', () => {
  it('seeds production-ready purchase invoice persona templates', async () => {
    const { repo, stored } = makeRepo();

    await seedSystemVoucherTypes(repo as any);

    const purchaseInvoices = stored.filter((template) =>
      ['purchase_invoice_direct', 'purchase_invoice_linked', 'purchase_invoice_service'].includes(template.code)
    );

    expect(purchaseInvoices).toHaveLength(3);
    expect(purchaseInvoices.map((template) => template.persona).sort()).toEqual(['direct', 'linked', 'service']);

    for (const template of purchaseInvoices) {
      expect(template.module).toBe('PURCHASE');
      expect(template.voucherType).toBe('purchase_invoice');

      const headerFieldIds = template.headerFields.map((field: any) => field.id);
      expect(headerFieldIds).toContain('vendorId');
      expect(headerFieldIds).not.toContain('supplierId');
      const vendorField = template.headerFields.find((field: any) => field.id === 'vendorId');
      expect(vendorField?.type).toBe('vendor-account-selector');

      const lineFieldIds = template.tableColumns.map((column: any) => column.fieldId);
      expect(lineFieldIds).toContain('invoicedQty');
      expect(lineFieldIds).toContain('unitPriceDoc');
      expect(lineFieldIds).toContain('taxCodeId');
      expect(lineFieldIds).not.toContain('quantity');
      expect(lineFieldIds).not.toContain('unitPrice');
    }
  });
});
