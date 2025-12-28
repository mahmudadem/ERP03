/**
 * Voucher Entry Modal
 * 
 * Modal for creating new voucher transactions using the designed voucher type template.
 * Uses GenericVoucherRenderer with real data binding and saves to backend.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Save, Loader2, Send } from 'lucide-react';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { UIMode } from '../../../api/companyApi';
import { UnsavedChangesModal } from './shared/UnsavedChangesModal';

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
  const [isSaving, setIsSaving] = useState(false);
  const [, forceUpdate] = useState({}); // To trigger totals update
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  const rendererRef = useRef<GenericVoucherRendererRef>(null);

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

  const handleSave = async (statusOverride?: string) => {
    try {
      setIsSaving(true);
      setError(null);
      
      // Extract data from GenericVoucherRenderer via ref
      if (!rendererRef.current) {
        throw new Error('Form ref not ready');
      }
      
      const formData = rendererRef.current.getData();
      
      // Build complete voucher payload
      // Refined Logic (Decoupled Forms):
      // - typeId: Must be the BASE STRATEGY (e.g. JOURNAL_ENTRY) so backend finds the definition.
      // - metadata.formId: The specific UI form config used (e.g. petty_cash).
      const voucherData = {
        ...formData,
        typeId: (voucherType as any).baseType || voucherType.id,
        metadata: {
          ...(formData.metadata || {}),
          formId: voucherType.id
        },
        status: typeof statusOverride === 'string' ? statusOverride : (initialData ? initialData.status : 'draft')
      };
      
      await onSave(voucherData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save voucher');
    } finally {
      setIsSaving(false);
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
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {initialData ? `Edit ${voucherType.name}` : `New ${voucherType.name}`}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                {initialData ? 'Update details below' : 'Fill in the details below'} • Mode: {uiMode === 'windows' ? 'Windows' : 'Web View'}
              </p>
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
                
                let bgColor = 'bg-[var(--color-bg-primary)]'; // Default
                if (hasValues) {
                  bgColor = isBalanced ? 'bg-success-100 dark:bg-success-900/20' : 'bg-danger-100 dark:bg-danger-900/20';
                }
                
                return (
                  <div className={`flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-colors border border-[var(--color-border)] shadow-sm`}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Debit</span>
                      <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
                        {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalDebit)}
                      </span>
                    </div>
                    <div className="w-[1px] h-5 bg-[var(--color-border)]" />
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Credit</span>
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
                onClick={() => handleSave('draft')}
                className="flex items-center gap-2 px-6 py-2 text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-primary-500" />
                    Save Draft
                  </>
                )}
              </button>

              <button
                onClick={() => handleSave('submitted')} 
                className="flex items-center gap-2 px-6 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 shadow-md"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                     <Loader2 className="w-4 h-4 animate-spin" />
                  </>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Submit
              </button>
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
