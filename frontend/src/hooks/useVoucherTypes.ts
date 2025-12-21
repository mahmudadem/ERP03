/**
 * Hook to load dynamic voucher types for sidebar menu
 */

import { useState, useEffect } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { loadCompanyVouchers } from '../modules/accounting/voucher-wizard/services/voucherWizardService';
import { VoucherTypeConfig } from '../modules/accounting/voucher-wizard/types';

export function useVoucherTypes() {
  const { companyId } = useCompanyAccess();
  const [voucherTypes, setVoucherTypes] = useState<VoucherTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVouchers() {
      if (!companyId) {
        setVoucherTypes([]);
        setLoading(false);
        return;
      }

      try {
        let vouchers = await loadCompanyVouchers(companyId);
        
        if (vouchers.length === 0) {
          const { loadDefaultTemplates } = await import('../modules/accounting/voucher-wizard/services/voucherWizardService');
          vouchers = await loadDefaultTemplates();
        }

        console.log(`[useVoucherTypes] Total loaded: ${vouchers.length} types`);
        
        // Only show enabled vouchers in sidebar
        const enabledVouchers = vouchers.filter(v => v.enabled !== false);
        setVoucherTypes(enabledVouchers);
      } catch (error) {
        console.error('Failed to load voucher types for sidebar:', error);
        setVoucherTypes([]);
      } finally {
        setLoading(false);
      }
    }

    // Load immediately
    loadVouchers();
  }, [companyId]);

  return { voucherTypes, loading };
}
