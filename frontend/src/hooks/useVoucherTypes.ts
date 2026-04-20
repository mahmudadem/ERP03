/**
 * Hook to load dynamic voucher types/forms for sidebar menu and rendering
 * 
 * Loads forms from ALL modules and exposes them grouped by module.
 * Each form carries its `module` and `sidebarGroup` for sidebar injection.
 * 
 * MIGRATION NOTE:
 * - First tries to load from new voucherForms collection (Phase 3)
 * - Falls back to old voucherTypes collection for backward compatibility  
 * - Eventually will fully migrate to voucherForms
 */

import { useState, useEffect } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { loadCompanyForms } from '../modules/accounting/voucher-wizard/services/voucherWizardService';
import { VoucherFormConfig } from '../modules/accounting/voucher-wizard/types';
import { voucherFormApi } from '../api/voucherFormApi';

export interface SidebarFormEntry {
  id: string;
  name: string;
  code: string;
  prefix: string;
  module: string;          // e.g., 'ACCOUNTING', 'SALES', 'PURCHASE'
  sidebarGroup?: string;   // e.g., 'Vouchers', 'Documents'. Null = top-level.
  enabled: boolean;
  baseType?: string;
}

export function useVoucherTypes() {
  const { companyId, moduleBundles, loading: accessLoading, permissionsLoaded } = useCompanyAccess();
  const hasAccountingModule = (moduleBundles || [])
    .map((moduleId) => String(moduleId || '').trim().toLowerCase())
    .includes('accounting');
  const canLoadForms = Boolean(companyId) && !accessLoading && permissionsLoaded && hasAccountingModule;

  const [voucherTypes, setVoucherTypes] = useState<VoucherFormConfig[]>([]);
  const [allModuleForms, setAllModuleForms] = useState<SidebarFormEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVouchers() {
      if (!canLoadForms) {
        setVoucherTypes([]);
        setAllModuleForms([]);
        setLoading(false);
        return;
      }

      try {
        // PHASE 3: Try loading from new voucherForms API first
        try {
          const forms = await voucherFormApi.list();
          if (forms && forms.length > 0) {
            // Build sidebar entries for ALL modules
            const sidebarEntries: SidebarFormEntry[] = forms
              .filter(f => f.enabled !== false)
              .map(form => ({
                id: form.id,
                name: form.name,
                code: form.code,
                prefix: form.prefix || form.code?.slice(0, 3).toUpperCase() || 'V',
                module: ((form as any).module || 'ACCOUNTING').toUpperCase(),
                sidebarGroup: (form as any).sidebarGroup || null,
                enabled: form.enabled,
                baseType: (form as any).baseType || form.typeId || form.code,
              }));

            setAllModuleForms(sidebarEntries);

            // BACKWARD COMPAT: Still provide accounting-only forms for existing consumers
            const accountingForms = forms.filter(f => {
              const mod = ((f as any).module || 'ACCOUNTING').toUpperCase();
              return mod === 'ACCOUNTING' && f.enabled !== false;
            });

            const configFromForms: VoucherFormConfig[] = accountingForms
              .map(form => ({
                id: form.id,
                code: form.code,
                name: form.name,
                prefix: form.prefix || form.code?.slice(0, 3).toUpperCase() || 'V',
                module: ((form as any).module || 'ACCOUNTING').toUpperCase(),
                enabled: form.enabled,
                headerFields: form.headerFields || [],
                tableColumns: form.tableColumns || [],
                uiModeOverrides: (form as any).uiModeOverrides || null,
                rules: (form as any).rules || [],
                actions: (form as any).actions || [],
                isMultiLine: (form as any).isMultiLine ?? true,
                tableStyle: (form as any).tableStyle || 'web',
                defaultCurrency: (form as any).defaultCurrency || '',
                _typeId: form.typeId,
                baseType: (form as any).baseType || form.typeId || form.code,
                sidebarGroup: (form as any).sidebarGroup || 'Vouchers',
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
        let vouchers = await loadCompanyForms(companyId);

        // Only show enabled vouchers in sidebar
        const enabledVouchers = vouchers.filter((v: VoucherFormConfig) => v.enabled !== false);
        setVoucherTypes(enabledVouchers);

        // Build sidebar entries from legacy too
        setAllModuleForms(enabledVouchers.map((v: any) => ({
          id: v.id,
          name: v.name,
          code: v.code || v.id,
          prefix: v.prefix || 'V',
          module: (v.module || 'ACCOUNTING').toUpperCase(),
          sidebarGroup: v.sidebarGroup || 'Vouchers',
          enabled: v.enabled !== false,
          baseType: v.baseType || v.code || v.id,
        })));
      } catch (error) {
        console.error('Failed to load voucher types for sidebar:', error);
        setVoucherTypes([]);
        setAllModuleForms([]);
      } finally {
        setLoading(false);
      }
    }

    setLoading(canLoadForms);
    loadVouchers();
  }, [canLoadForms]);

  return { voucherTypes, allModuleForms, loading };
}
