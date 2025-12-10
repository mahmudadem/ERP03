
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
        // No mapping needed as we use the flat structure directly in DynamicVoucherRenderer

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
