
import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';
import { designerApi } from '../api/designerApi';

// Mock removed


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
        
        // Map backend structure to frontend structure if needed
        if (!def.header && def.headerFields) {
            def.header = {
                id: def.id + '_header',
                name: def.name,
                module: def.module,
                type: 'HEADER',
                fields: def.headerFields,
                sections: [{
                    id: 'default_section',
                    title: 'General Information',
                    fieldIds: def.headerFields.map((f: any) => f.id)
                }],
                rules: [] // TODO: Map rules if they exist in layout or separate field
            } as any;
        }

        if (!def.lines && def.tableColumns) {
            def.lines = {
                id: def.id + '_lines',
                columns: def.tableColumns
            } as any;
        }

        setDefinition(def);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load voucher definition', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDef();
  }, [voucherTypeCode]);

  return { definition, loading, error };
};
