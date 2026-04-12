import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: React.ReactNode;
  tone?: 'info' | 'warning' | 'danger';
  isConfirming?: boolean;
}

const toneStyles: Record<NonNullable<ConfirmDialogProps['tone']>, { panel: string; iconBg: string; iconText: string; confirmButton: string }> = {
  info: {
    panel: 'border-blue-200 bg-blue-50',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-700',
    confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200',
  },
  warning: {
    panel: 'border-amber-200 bg-amber-50',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-700',
    confirmButton: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-200',
  },
  danger: {
    panel: 'border-rose-200 bg-rose-50',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-700',
    confirmButton: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-200',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  tone = 'warning',
  isConfirming = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirming, isOpen, onCancel]);

  if (!isOpen) return null;

  const styles = toneStyles[tone];

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={() => !isConfirming && onCancel()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className={`flex items-start gap-4 border-b border-slate-100 px-6 py-5 ${styles.panel}`}>
          {icon ? (
            <div className={`mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl ${styles.iconBg} ${styles.iconText}`}>
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-lg font-black text-slate-900">
              {title}
            </h2>
            <div className="mt-2 text-sm leading-6 text-slate-700">{message}</div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${styles.confirmButton}`}
          >
            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
