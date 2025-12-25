/**
 * useVoucherForms.ts
 * 
 * Hook to load VoucherForms (UI layouts) from the backend API
 * These are used for rendering vouchers with the correct layout
 */

import { useState, useEffect, useCallback } from 'react';
import { useCompanyAccess } from '../context/CompanyAccessContext';
import { voucherFormApi, VoucherFormResponse } from '../api/voucherFormApi';

export interface VoucherFormConfig extends VoucherFormResponse {
  // Extended for UI usage
}

export function useVoucherForms() {
  const { companyId } = useCompanyAccess();
  const [forms, setForms] = useState<VoucherFormConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    if (!companyId) {
      setForms([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await voucherFormApi.list();
      // Filter only enabled forms
      const enabledForms = data.filter(f => f.enabled !== false);
      setForms(enabledForms);
    } catch (err: any) {
      console.error('[useVoucherForms] Failed to load forms:', err);
      setError(err.message || 'Failed to load voucher forms');
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  /**
   * Get the default form for a specific type
   */
  const getDefaultFormForType = useCallback((typeId: string): VoucherFormConfig | undefined => {
    return forms.find(f => f.typeId === typeId && f.isDefault);
  }, [forms]);

  /**
   * Get all forms for a specific type
   */
  const getFormsForType = useCallback((typeId: string): VoucherFormConfig[] => {
    return forms.filter(f => f.typeId === typeId);
  }, [forms]);

  /**
   * Get form by ID
   */
  const getFormById = useCallback((formId: string): VoucherFormConfig | undefined => {
    return forms.find(f => f.id === formId);
  }, [forms]);

  /**
   * Refresh forms from backend
   */
  const refresh = useCallback(() => {
    loadForms();
  }, [loadForms]);

  return {
    forms,
    loading,
    error,
    getDefaultFormForType,
    getFormsForType,
    getFormById,
    refresh
  };
}
