/**
 * Voucher Entry Modal
 * 
 * Modal for creating new voucher transactions using the designed voucher type template.
 * Uses GenericVoucherRenderer with real data binding and saves to backend.
 */

import React, { useState, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { GenericVoucherRenderer, GenericVoucherRendererRef } from './shared/GenericVoucherRenderer';
import { UIMode } from '../../../api/companyApi';

interface VoucherEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucherType: VoucherFormConfig;
  uiMode: UIMode;
  onSave: (data: any) => Promise<void>;
}

export const VoucherEntryModal: React.FC<VoucherEntryModalProps> = ({
  isOpen,
  onClose,
  voucherType,
  uiMode,
  onSave
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rendererRef = useRef<GenericVoucherRendererRef>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
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
        status: 'draft'
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
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                New {voucherType.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Fill in the details below • Mode: {uiMode === 'windows' ? 'Windows' : 'Classic'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isSaving}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <GenericVoucherRenderer 
              ref={rendererRef}
              definition={voucherType as any}
              mode={uiMode}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Voucher
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
