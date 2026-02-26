
import { useState, useEffect } from 'react';
import { VoucherTypeDefinition } from '../designer-engine/types/VoucherTypeDefinition';
import { designerApi } from '../api/designerApi';
import { voucherFormApi } from '../api/voucherFormApi';

import { getVoucherFormById } from '../modules/accounting/voucher-wizard/services/voucherWizardService';

/**
 * Map a VoucherFormResponse (from backend voucher-forms API) to a VoucherTypeDefinition
 */
function mapFormToDefinition(form: any): any {
  return {
    ...form,
    code: form.code || form.id,
    module: 'accounting',
    headerFields: form.headerFields || [],
    tableColumns: form.tableColumns || [],
    baseType: form.baseType || form.typeId,
  };
}

export const useVoucherTypeDefinition = (voucherTypeCode: string, companyId?: string) => {
  const [definition, setDefinition] = useState<VoucherTypeDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!voucherTypeCode) return;

    const fetchDef = async () => {
      setLoading(true);
      try {
        // 1. Try fetching from Backend Designer API (for Base Types / Fixed Strategies)
        const def = await designerApi.getVoucherTypeByCode(voucherTypeCode);
        setDefinition(def);
        setError(null);
        return;
      } catch (err: any) {
        console.debug(`[useVoucherTypeDefinition] Designer API miss for "${voucherTypeCode}", trying voucher-forms API...`);
      }

      // 2. Try Backend voucher-forms API (for company-specific forms stored in DB)
      try {
        // First try by ID (if voucherTypeCode looks like an ID/UUID)
        const form = await voucherFormApi.getById(voucherTypeCode);
        if (form) {
          setDefinition(mapFormToDefinition(form));
          setError(null);
          return;
        }
      } catch (err: any) {
        console.debug(`[useVoucherTypeDefinition] voucher-forms API miss for "${voucherTypeCode}", trying list match...`);
      }

      // 3. Try matching by code from the voucher-forms list
      try {
        const allForms = await voucherFormApi.list();
        const match = (allForms || []).find(
          (f: any) => f.code === voucherTypeCode || f.typeId === voucherTypeCode || f.baseType === voucherTypeCode
        );
        if (match) {
          setDefinition(mapFormToDefinition(match));
          setError(null);
          return;
        }
      } catch (err: any) {
        console.debug(`[useVoucherTypeDefinition] voucher-forms list match failed for "${voucherTypeCode}"`);
      }

      // 4. Legacy Firestore fallback (for forms that haven't been migrated yet)
      if (companyId) {
        try {
          const formConfig = await getVoucherFormById(companyId, voucherTypeCode);
          if (formConfig) {
            const mappedDefinition: any = {
               ...formConfig,
               code: formConfig.id,
               module: 'accounting',
               headerFields: formConfig.headerFields || [], 
               baseType: (formConfig as any).baseType
            };
            setDefinition(mappedDefinition);
            setError(null);
            return;
          }
        } catch (fbErr) {
          console.debug('[useVoucherTypeDefinition] Firestore fallback failed:', fbErr);
        }
      }
      
      console.error(`[useVoucherTypeDefinition] All lookup strategies failed for: ${voucherTypeCode}`);
      setError('Voucher type not found');
      setLoading(false);
    };

    fetchDef().finally(() => setLoading(false));
  }, [voucherTypeCode, companyId]);

  return { definition, loading, error };
};
