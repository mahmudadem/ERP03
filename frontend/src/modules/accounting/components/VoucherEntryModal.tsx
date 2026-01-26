/**
 * Voucher Entry Modal
 * 
 * Modal for creating new voucher transactions using the designed voucher type template.
 * Uses GenericVoucherRenderer with real data binding and saves to backend.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, Send, CheckCircle } from 'lucide-react';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { UIMode } from '../../../api/companyApi';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { clsx } from 'clsx';

interface VoucherEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherType: VoucherFormConfig;
  uiMode: UIMode;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export const VoucherEntryModal: React.FC<VoucherEntryModalProps> = ({
  isOpen,
  onClose,
  voucherType,
  uiMode,
  onSave,
  initialData
}) => {
  const { settings, isLoading: settingsLoading } = useCompanySettings();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, forceUpdate] = useState({}); // To trigger totals update
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  const rendererRef = useRef<GenericVoucherRendererRef>(null);

  const isVoucherReadOnly = React.useMemo(() => {
    if (!initialData?.status) return false;
    const status = initialData.status.toLowerCase();
    
    // In STRICT mode, many statuses are read-only
    if (settings?.strictApprovalMode === true) {
      return ['posted', 'approved', 'locked'].includes(status);
    }
    
    // In FLEXIBLE mode (default), only locked is read-only
    return status === 'locked';
  }, [initialData?.status, settings?.strictApprovalMode]);

  if (!isOpen) return null;

  const handleCloseAttempt = () => {
    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedModal(false);
    onClose();
  };

  const handleSaveVoucher = async (statusOverride?: string) => {
    try {
      const isSubmit = statusOverride === 'submitted';
      if (isSubmit) setIsSubmitting(true);
      else setIsSaving(true);
      
      setError(null);
      
      // Extract data from GenericVoucherRenderer via ref
      if (!rendererRef.current) {
        throw new Error('Form ref not ready');
      }
      
      const formData = rendererRef.current.getData();
      
      // Build complete voucher payload
      const voucherData = {
        ...formData,
        typeId: (voucherType as any).baseType || voucherType.id,
        metadata: {
          ...(formData.metadata || {}),
          formId: voucherType.id,
          creationMode: settings?.strictApprovalMode ? 'STRICT' : 'FLEXIBLE'
        },
        status: typeof statusOverride === 'string' ? statusOverride : (initialData ? initialData.status : 'draft')
      };
      
      await onSave(voucherData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save voucher');
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleCloseAttempt}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-[var(--color-bg-primary)] rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-[var(--color-border)] transition-colors duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {initialData ? `Edit ${voucherType.name}` : `New ${voucherType.name}`}
                </h2>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {initialData ? 'Update details below' : 'Fill in the details below'} • Mode: {uiMode === 'windows' ? 'Windows' : 'Web View'}
                </p>
              </div>

              {/* Status Badge & Dot */}
              <div className="flex items-center gap-2 mb-[-10px]">
                {initialData?.status && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
                    initialData.status.toLowerCase() === 'approved' || initialData.status.toLowerCase() === 'posted' ? 'bg-success-100/80 text-success-700 dark:bg-success-900/30 dark:text-success-400' :
                    initialData.status.toLowerCase() === 'draft' ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]' :
                    initialData.status.toLowerCase() === 'pending' ? 'bg-amber-100/80 text-amber-700' :
                    'bg-primary-100/80 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  }`}>
                    {initialData.status}
                  </span>
                )}

                {/* Status Indicator Dot - Visual Clue for Approval Mode */}
                <div className="group relative">
                  <div 
                    className={`w-2 h-2 rounded-full transition-all cursor-help ${
                      settingsLoading ? 'bg-gray-400 animate-pulse' : 
                      (settings?.strictApprovalMode ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]')
                    }`} 
                  />
                  <div className="absolute left-0 top-6 hidden group-hover:block bg-gray-800 text-white text-[10px] p-2 rounded-md shadow-xl whitespace-nowrap z-50 border border-gray-700">
                    <div className="font-bold mb-1 border-b border-gray-600 pb-1">System Mode</div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-gray-400">Policy:</span>
                      <span className={settings?.strictApprovalMode ? "text-indigo-300" : "text-emerald-300"}>
                        {settings?.strictApprovalMode ? 'Strict (Approval Required)' : 'Flexible (Auto-Post)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleCloseAttempt}
              className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
              disabled={isSaving}
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 bg-danger-50 dark:bg-danger-900/10 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 custom-scroll">
            <GenericVoucherRenderer 
              ref={rendererRef}
              definition={voucherType as any}
              mode={uiMode}
              initialData={initialData}
              readOnly={isVoucherReadOnly}
              onChange={() => {
                setIsDirty(true);
                forceUpdate({});
              }}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] transition-colors duration-300">
            
            {/* Totals Display */}
            <div className="flex items-center gap-4">
              {(() => {
                const rows = rendererRef.current?.getRows() || [];
                const totalDebit = rows.reduce((sum: number, row: any) => sum + (parseFloat(row.debit) || 0), 0);
                const totalCredit = rows.reduce((sum: number, row: any) => sum + (parseFloat(row.credit) || 0), 0);
                const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
                const hasValues = totalDebit > 0 || totalCredit > 0;
                
                const bgColor = !hasValues ? 'bg-[var(--color-bg-tertiary)]' : (isBalanced ? 'bg-success-100/30 dark:bg-success-900/20' : 'bg-danger-100/30 dark:bg-danger-900/20');
                const borderColor = !hasValues ? 'border-[var(--color-border)]' : (isBalanced ? 'border-success-500/30' : 'border-danger-500/30');
                
                return (
                  <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-all border ${borderColor} shadow-sm`}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Total Debit ({voucherType.defaultCurrency || ''})</span>
                      <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalDebit)}
                      </span>
                    </div>
                    <div className="w-[1px] h-5 bg-[var(--color-border)] opacity-50" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Total Credit ({voucherType.defaultCurrency || ''})</span>
                      <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCredit)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCloseAttempt}
                className="px-4 py-2 text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              
              <button
                onClick={() => handleSaveVoucher()}
                className={clsx(
                  "flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 border",
                  settingsLoading 
                    ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)]' 
                    : settings?.strictApprovalMode === true
                      // Strict Mode: 'Save as Draft' is Secondary action
                      ? 'bg-[var(--color-bg-primary)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                      // Flexible Mode: 'Save & Post' is Primary action
                      : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm',
                  // HIDE if not draft (and not pending which has its own label)
                  settings?.strictApprovalMode === true && initialData?.status && initialData.status.toLowerCase() !== 'draft' && initialData.status.toLowerCase() !== 'pending' && 'hidden'
                )}
                disabled={isSaving || settingsLoading}
              >
                {isSaving || settingsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {settingsLoading ? 'Loading...' : (settings?.strictApprovalMode === true ? 'Saving...' : 'Posting...')}
                  </>
                ) : (
                  <>
                    {(() => {
                      if (settings?.strictApprovalMode !== true) return <CheckCircle className="w-4 h-4" />;
                      const status = initialData?.status?.toLowerCase();
                      if (status === 'pending' || status === 'approved' || status === 'posted') return <Save className="w-4 h-4" />;
                      return <Save className="w-4 h-4" />;
                    })()}
                    {(() => {
                      if (settings?.strictApprovalMode !== true) return 'Save & Post';
                      const status = initialData?.status?.toLowerCase();
                      if (status === 'pending') return 'Update Pending Voucher';
                      if (status === 'approved' || status === 'posted') return 'Save Changes';
                      return 'Save as Draft';
                    })()}
                  </>
                )}
              </button>

              {/* Submit button only shown when strict mode is explicitly true */}
              {!settingsLoading && settings?.strictApprovalMode === true && (!initialData?.status || initialData?.status?.toLowerCase() === 'draft' || initialData?.status?.toLowerCase() === 'rejected') && (
                <button
                  onClick={() => handleSaveVoucher('submitted')} 
                  className="flex items-center gap-2 px-6 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Approval
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <UnsavedChangesModal 
        isOpen={showUnsavedModal}
        onCancel={() => setShowUnsavedModal(false)}
        onConfirm={handleConfirmClose}
      />
    </div>
  );
};
