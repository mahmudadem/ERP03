import React, { useState, useEffect } from 'react';
import { VoucherFormDesigner, WizardProvider, loadDefaultTemplates, loadCompanyForms, saveVoucherForm, VoucherFormConfig } from '../voucher-wizard';
import { Button } from '../../../components/ui/Button';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAuth } from '../../../context/AuthContext';
import { AlertCircle, Loader2 } from 'lucide-react';

/**
 * AI Designer Page (Voucher Wizard Integration)
 * 
 * Integrated with the extracted voucher wizard and real database operations
 */
export default function AIDesignerPage() {
  const { companyId } = useCompanyAccess();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<VoucherFormConfig[]>([]);
  const [forms, setForms] = useState<VoucherFormConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load templates and company forms on mount
  useEffect(() => {
    async function loadData() {
      if (!companyId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const [loadedTemplates, loadedForms] = await Promise.all([
          loadDefaultTemplates(),
          loadCompanyForms(companyId)
        ]);
        
        setTemplates(loadedTemplates);
        setForms(loadedForms);
      } catch (err) {
        console.error('Failed to load voucher data:', err);
        setError('Failed to load voucher forms. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [companyId]);

  const handleVoucherSaved = async (config: VoucherFormConfig, isEdit: boolean) => {
    if (!companyId || !user) {
      setError('Missing company ID or user information');
      return;
    }

    try {
      const result = await saveVoucherForm(companyId, config, user.uid, isEdit);
      
      if (result.success) {
        // Reload all forms to ensure we're in sync with database
        const updatedForms = await loadCompanyForms(companyId);
        setForms(updatedForms);
        setError(null);
      } else {
        setError(result.errors?.join(', ') || 'Failed to save voucher form');
      }
    } catch (err) {
      console.error('Failed to save voucher form:', err);
      setError('Failed to save voucher form. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin h-8 w-8 mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading forms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-red-900">Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-3">
              Reload Page
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <WizardProvider initialForms={forms}>
      <VoucherFormDesigner
        templates={templates}
        onVoucherSaved={handleVoucherSaved}
        onExit={() => {/* Could navigate away if needed */}}
      />
    </WizardProvider>
  );
}
