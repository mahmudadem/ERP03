/**
 * Hook to load dynamic voucher types/forms for sidebar menu and rendering
 * 
 * MIGRATION NOTE:
 * - First tries to load from new voucherForms collection (Phase 3)
 * - Falls back to old voucherTypes collection for backward compatibility  
 * - Eventually will fully migrate to voucherForms
 */

import { useState, useEffect } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { loadCompanyVouchers } from '../modules/accounting/voucher-wizard/services/voucherWizardService';
import { VoucherTypeConfig } from '../modules/accounting/voucher-wizard/types';
import { voucherFormApi } from '../api/voucherFormApi';

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
        // PHASE 3: Try loading from new voucherForms API first
        try {
          const forms = await voucherFormApi.list();
          if (forms && forms.length > 0) {
            console.log(`[useVoucherTypes] Loaded ${forms.length} forms from voucherForms API`);
            
            // Convert VoucherForm to VoucherTypeConfig for backward compatibility
            const configFromForms: VoucherTypeConfig[] = forms
              .filter(f => f.enabled !== false)
              .map(form => ({
                id: form.id,
                code: form.code,
                name: form.name,
                prefix: form.prefix || form.code?.slice(0, 3).toUpperCase() || 'V',
                module: 'ACCOUNTING',
                enabled: form.enabled,
                headerFields: form.headerFields || [],
                tableColumns: form.tableColumns || [],
                // Additional layout data
                uiModeOverrides: (form as any).uiModeOverrides || null,
                rules: (form as any).rules || [],
                actions: (form as any).actions || [],
                isMultiLine: (form as any).isMultiLine ?? true,
                defaultCurrency: (form as any).defaultCurrency || 'USD',
                // Keep typeId reference for backend operations
                _typeId: form.typeId,
                baseType: (form as any).baseType || form.typeId || form.code, // Base voucher type for backend
                _isForm: true
              } as any));
            
            setVoucherTypes(configFromForms);
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          console.warn('[useVoucherTypes] voucherForms API failed, falling back to legacy:', apiErr);
        }

        // FALLBACK: Load from legacy voucherTypes (Firebase direct)
        let vouchers = await loadCompanyVouchers(companyId);
        
        if (vouchers.length === 0) {
          const { loadDefaultTemplates } = await import('../modules/accounting/voucher-wizard/services/voucherWizardService');
          vouchers = await loadDefaultTemplates();
        }

        console.log(`[useVoucherTypes] Total loaded (legacy): ${vouchers.length} types`);
        
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

