import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { RateDeviationResult } from '../../utils/rateDeviationCheck';

interface RateDeviationDialogProps {
  isOpen: boolean;
  result: RateDeviationResult;
  baseCurrency: string;
  voucherDate: string;
  onConfirm: () => void;
  onConfirmWithSync?: () => void;
  onCancel: () => void;
}

export const RateDeviationDialog: React.FC<RateDeviationDialogProps> = ({
  isOpen,
  result,
  baseCurrency,
  voucherDate,
  onConfirm,
  onConfirmWithSync,
  onCancel
}) => {
  if (!isOpen) return null;

  const formatNumber = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--color-bg-primary)] rounded-xl shadow-2xl max-w-lg w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200 border border-[var(--color-border)]">
        {/* Header */}
        <div className="bg-amber-500 text-white px-6 py-4 flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <AlertTriangle size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold leading-tight">Exchange Rate Deviation</h2>
            <div className="flex items-center gap-2 text-amber-100 text-xs mt-0.5">
               <span>Checking rates for <b>{voucherDate}</b></span>
               <span className="opacity-50">|</span>
               <span>Tolerance: 1%</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scroll">
          <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
            The effective rates in your voucher differ from the system rates recorded for <span className="font-bold text-[var(--color-text-primary)]">{voucherDate}</span>.
          </p>

          {/* Warnings Table */}
          <div className="border border-[var(--color-border)] rounded-lg overflow-hidden mb-5 bg-[var(--color-bg-secondary)]/30">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] uppercase tracking-wider font-bold">
                  <th className="px-4 py-2.5 text-left">Currency</th>
                  <th className="px-4 py-2.5 text-right">Effective</th>
                  <th className="px-4 py-2.5 text-center"></th>
                  <th className="px-4 py-2.5 text-right">System</th>
                  <th className="px-4 py-2.5 text-right">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {result.warnings.map((warning, idx) => (
                  <tr key={idx} className="hover:bg-[var(--color-bg-secondary)]/50 transition-colors">
                    <td className="px-4 py-3 text-[var(--color-text-primary)] font-bold">{warning.lineCurrency}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-primary)] font-mono">
                      {formatNumber(warning.effectiveRate)}
                    </td>
                    <td className="px-4 py-3 text-center text-[var(--color-text-muted)]">
                      <ArrowRight size={14} className="mx-auto opacity-50" />
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-text-primary)] font-mono">
                      {formatNumber(warning.systemRate)}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${Math.abs(warning.deviation) > 1 ? (warning.deviation > 0 ? 'text-red-500' : 'text-amber-600') : 'text-green-500'}`}>
                      {warning.deviation > 0 ? '+' : ''}{warning.deviation}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Impact Summary */}
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 mb-2">
            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 mb-2 uppercase tracking-wide">Posting Impact ({baseCurrency})</h4>
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="space-y-1">
                <div className="text-amber-700/60 dark:text-amber-400/60 font-medium">Effective Balance:</div>
                <div className="font-mono text-[var(--color-text-primary)] flex justify-between">
                  <span>D {formatNumber(result.totalEffectiveBase.debit)}</span>
                  <span>C {formatNumber(result.totalEffectiveBase.credit)}</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-amber-700/60 dark:text-amber-400/60 font-medium">System Rate Balance:</div>
                <div className="font-mono text-[var(--color-text-primary)] flex justify-between">
                  <span>D {formatNumber(result.totalSystemBase.debit)}</span>
                  <span>C {formatNumber(result.totalSystemBase.credit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-[var(--color-border)] px-6 py-4 flex flex-col sm:flex-row gap-3 bg-[var(--color-bg-secondary)]">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-primary)] transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-text-muted)] transition-all active:scale-95"
          >
            Proceed
          </button>
          {onConfirmWithSync && (
            <button
              onClick={onConfirmWithSync}
              className="flex-[1.5] px-4 py-2.5 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-md shadow-primary-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              Proceed & Sync
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
