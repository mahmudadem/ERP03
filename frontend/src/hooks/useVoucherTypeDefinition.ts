
import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';
import { designerApi } from '../api/designerApi';

const getMockVoucher = (code: string): VoucherTypeDefinition | null => {
  if (code !== 'INV') return null;
  return {
    id: 'inv_mock',
    name: 'Sales Invoice (Mock)',
    code: 'INV',
    module: 'ACCOUNTING',
    header: {
      id: 'inv_head',
      name: 'Header',
      module: 'ACCOUNTING',
      version: 1,
      fields: [
        { id: 'f1', name: 'date', label: 'Date', type: 'DATE', required: true, width: '1/4' },
        { id: 'f2', name: 'currency', label: 'Currency', type: 'TEXT', width: '1/4' }
      ],
      sections: [{ id: 's1', title: 'Info', fieldIds: ['f1', 'f2'] }],
      rules: []
    },
    lines: {
      id: 'inv_lines',
      name: 'lines',
      addRowLabel: 'Add Line',
      columns: [
        { id: 'c1', name: 'description', label: 'Description', type: 'TEXT', width: '1/2' },
        { id: 'c2', name: 'fxAmount', label: 'Amount', type: 'NUMBER', width: '1/4' }
      ]
    },
    summaryFields: []
  };
};

export const useVoucherTypeDefinition = (voucherTypeCode: string) => {
  const [definition, setDefinition] = useState<VoucherTypeDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voucherTypeCode) return;

    const fetchDef = async () => {
      setLoading(true);
      try {
        const def = await designerApi.getVoucherTypeByCode(voucherTypeCode);
        setDefinition(def);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load voucher definition', err);
        const is404 = err?.response?.status === 404;
        const mock = getMockVoucher(voucherTypeCode);
        if (mock) {
          setDefinition(mock);
          setError(is404 ? null : err.message);
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDef();
  }, [voucherTypeCode]);

  return { definition, loading, error };
};
