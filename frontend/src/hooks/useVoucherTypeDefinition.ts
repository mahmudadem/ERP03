
import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';
import { designerApi } from '../api/designerApi';

// Mock removed


import { getVoucherFormById } from '../modules/accounting/voucher-wizard/services/voucherWizardService';

export const useVoucherTypeDefinition = (voucherTypeCode: string, companyId?: string) => {
  const [definition, setDefinition] = useState<VoucherTypeDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voucherTypeCode) return;

    const fetchDef = async () => {
      setLoading(true);
      try {
        // 1. Try fetching from Backend API (for Base Types / Fixed Strategies)
        const def = await designerApi.getVoucherTypeByCode(voucherTypeCode);
        setDefinition(def);
        setError(null);
      } catch (err: any) {
        // 2. If API fails (likely 404 because it's a UI-only Form), try Firestore if companyId is provided
        if (companyId) {
          try {
            const formConfig = await getVoucherFormById(companyId, voucherTypeCode);
            
            if (formConfig) {
              // Convert VoucherFormConfig to VoucherTypeDefinition structure expected by the renderer
              // The renderer expects specific fields which might differ slightly
              // But VoucherFormConfig has almost everything needed if we cast/map it
              
              const mappedDefinition: any = {
                 ...formConfig,
                 code: formConfig.id,
                 module: 'accounting',
                 // Map headers/lines layout if needed, effectively mimicking the backend response
                 // Usually the backend response for a VoucherTypeDefinition matches the interface
                 // We might need to ensure headerFields are present as array
                 headerFields: formConfig.headerFields || [], 
                 // We use the baseType as the "code" for transaction logic if needed, 
                 // but for UI rendering we use the form config.
                 // Ideally we should preserve baseType in a separate field.
                 baseType: (formConfig as any).baseType
              };
              
              setDefinition(mappedDefinition);
              setError(null);
              return;
            }
          } catch (fbErr) {
            console.error('Fallback load failed:', fbErr);
          }
        }
        
        console.error('Failed to load voucher definition', err);
        setError(err.message || 'Voucher type not found');
      } finally {
        setLoading(false);
      }
    };

    fetchDef();
  }, [voucherTypeCode, companyId]);

  return { definition, loading, error };
};
