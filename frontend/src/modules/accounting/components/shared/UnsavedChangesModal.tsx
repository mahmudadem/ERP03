import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation('accounting');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-[var(--color-bg-primary)] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden border border-[var(--color-border)] transition-colors">
        
        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
             <div>
               <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{t('unsavedChangesModal.title')}</h3>
               <p className="text-[var(--color-text-secondary)] leading-relaxed">
                 {t('unsavedChangesModal.description')}
               </p>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[var(--color-bg-secondary)] px-6 py-4 flex justify-end gap-3 border-t border-[var(--color-border)] transition-colors">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] border border-[var(--color-border)] font-bold rounded-lg hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            {t('unsavedChangesModal.cancel')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-danger-600 text-white font-bold rounded-lg hover:bg-danger-700 transition-colors shadow-sm"
          >
            {t('unsavedChangesModal.closeWithoutSaving')}
          </button>
        </div>
      </div>
    </div>
  );
};
