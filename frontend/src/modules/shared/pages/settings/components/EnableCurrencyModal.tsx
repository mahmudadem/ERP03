import React, { useState } from 'react';
import { X, Check, Loader2, Info } from 'lucide-react';
import { accountingApi, CurrencyDTO } from '../../../../../api/accountingApi';
import { errorHandler } from '../../../../../services/errorHandler';

interface EnableCurrencyModalProps {
  currency: CurrencyDTO;
  baseCurrency: string;
  onClose: () => void;
  onEnabled: () => void;
}

export const EnableCurrencyModal: React.FC<EnableCurrencyModalProps> = ({ 
  currency, 
  baseCurrency, 
  onClose, 
  onEnabled 
}) => {
  const [rate, setRate] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleEnable = async () => {
    if (!rate || parseFloat(rate) <= 0) {
      errorHandler.showError('Please enter a valid exchange rate');
      return;
    }

    setSaving(true);
    try {
      await accountingApi.enableCurrency(
        currency.code,
        parseFloat(rate),
        (() => {
          const now = new Date();
          return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        })()
      );
      errorHandler.showSuccess(`${currency.code} enabled successfully!`);
      onEnabled();
      onClose();
    } catch (error: any) {
      errorHandler.showError(error.message || 'Failed to enable currency');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[var(--color-border)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-[var(--color-border)] flex items-center justify-between bg-gray-50 dark:bg-gray-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
            Enable {currency.code}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                An initial exchange rate is required to enable <span className="font-bold underline">{currency.code}</span>. 
                This will be used as the reference rate for your accounting operations.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-3 uppercase tracking-wider">
              Initial Exchange Rate
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-none px-4 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-lg font-bold text-gray-900 dark:text-white border border-gray-200 dark:border-[var(--color-border)] text-sm">
                1 {currency.code}
              </div>
              <div className="text-lg font-bold text-gray-300">=</div>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="0.0000"
                  className="w-full pl-4 pr-12 py-2.5 bg-gray-50 dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] dark:text-[var(--color-text-primary)] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-bold text-lg"
                  autoFocus
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 uppercase">{baseCurrency}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-[var(--color-border)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnable}
            disabled={saving || !rate}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 text-sm font-bold disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Enabling...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Enable Currency</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
