import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, X } from 'lucide-react';

interface TotalsLine {
  account?: string;
  accountId?: string;
  debit?: number | string;
  credit?: number | string;
  currency?: string;
  parity?: number | string;
  equivalent?: number | string;
}

interface VoucherTotalsDisplayProps {
  totalDebit: number;
  totalCredit: number;
  currency: string;
  isBalanced: boolean;
  difference?: number;
  // Tooltip data
  lines?: TotalsLine[];
  baseCurrency?: string;
  headerRate?: number;
}

export const VoucherTotalsDisplay: React.FC<VoucherTotalsDisplayProps> = ({
  totalDebit,
  totalCredit,
  currency,
  isBalanced,
  difference,
  lines,
  baseCurrency,
  headerRate
}) => {
  const { t } = useTranslation('accounting');
  const hasValues = totalDebit > 0 || totalCredit > 0;
  const diff = difference !== undefined ? difference : Math.abs(totalDebit - totalCredit);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  const bgColor = !hasValues 
    ? 'bg-[var(--color-bg-tertiary)]' 
    : (isBalanced ? 'bg-success-100/30 dark:bg-success-900/20' : 'bg-danger-100/30 dark:bg-danger-900/20');
    
  const borderColor = !hasValues 
    ? 'border-[var(--color-border)]' 
    : (isBalanced ? 'border-success-500/30' : 'border-danger-500/30');

  const format = (val: number) => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

  const formatCompact = (val: number) => new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(val);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!showTooltip) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    // Delay listener to avoid closing immediately from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTooltip]);

  // Build line breakdown for tooltip
  const debitLines = (lines || []).filter(l => (parseFloat(l.debit as string) || 0) > 0);
  const creditLines = (lines || []).filter(l => (parseFloat(l.credit as string) || 0) > 0);
  const isForeignVoucher = baseCurrency && currency && baseCurrency.toUpperCase() !== currency.toUpperCase();

  const renderLineBreakdown = (lineList: TotalsLine[], side: 'debit' | 'credit') => {
    if (lineList.length === 0) return <span className="text-[var(--color-text-muted)] italic text-[10px]">No lines</span>;

    return lineList.map((line, idx) => {
      const amount = side === 'debit' ? (parseFloat(line.debit as string) || 0) : (parseFloat(line.credit as string) || 0);
      const parity = parseFloat(line.parity as string) || 1;
      const equivalent = parseFloat(line.equivalent as string) || 0;
      const lineCurrency = line.currency || currency;
      const accountLabel = line.account || line.accountId || `Line ${idx + 1}`;
      const shortAccount = accountLabel.length > 20 ? accountLabel.slice(0, 18) + '…' : accountLabel;

      return (
        <div key={idx} className="flex items-center gap-2 text-[10px] font-mono leading-tight py-0.5">
          <span className="text-[var(--color-text-muted)] w-[100px] truncate" title={accountLabel}>{shortAccount}</span>
          <span className="text-[var(--color-text-primary)]">{formatCompact(amount)}</span>
          <span className="text-[var(--color-text-muted)]">{lineCurrency}</span>
          <span className="text-[var(--color-text-muted)]">×</span>
          <span className="text-primary-500">{formatCompact(parity)}</span>
          <span className="text-[var(--color-text-muted)]">=</span>
          <span className="font-bold text-[var(--color-text-primary)]">{formatCompact(equivalent)}</span>
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative flex items-center gap-6 px-4 py-2 ${bgColor} rounded-md transition-all border ${borderColor} shadow-sm`}>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest list-none">
            {t('voucherTotals.totalDebit', 'Total Debit')} ({currency})
          </span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
            {format(totalDebit)}
          </span>
        </div>
        
        <div className="w-[1px] h-5 bg-[var(--color-border)] opacity-50" />
        
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('voucherTotals.totalCredit', 'Total Credit')} ({currency})
          </span>
          <span className="text-base font-bold text-[var(--color-text-primary)] font-mono">
            {format(totalCredit)}
          </span>
        </div>

        {/* Info icon — click to toggle breakdown */}
        {hasValues && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(prev => !prev);
            }}
            className={`p-1 rounded-full transition-all ${
              showTooltip 
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' 
                : 'text-[var(--color-text-muted)] hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20'
            }`}
            title={t('voucherTotals.viewBreakdown', 'View totals breakdown')}
          >
            <Info size={14} />
          </button>
        )}

        {/* Popover Panel */}
        {showTooltip && hasValues && (
          <div 
            ref={tooltipRef} 
            className="absolute bottom-full left-0 mb-2 z-[9999] w-max max-w-[480px] animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-4 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
                <Info size={14} className="text-primary-500" />
                <span className="text-xs font-bold text-[var(--color-text-primary)]">{t('voucherTotals.breakdown', 'Totals Breakdown')}</span>
                {isForeignVoucher && headerRate && (
                  <span className="ml-auto mr-6 text-[10px] text-[var(--color-text-muted)] font-mono">
                    1 {currency} = {formatCompact(headerRate)} {baseCurrency}
                  </span>
                )}
                <button 
                  onClick={() => setShowTooltip(false)}
                  className="absolute top-3 right-3 p-0.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Debit Section */}
              {lines && lines.length > 0 && (
                <>
                  <div>
                    <div className="text-[10px] font-bold text-success-600 dark:text-success-400 uppercase tracking-wider mb-1">
                      {t('voucherTotals.debitLines', 'Debit Lines')}
                    </div>
                    {renderLineBreakdown(debitLines, 'debit')}
                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-dashed border-[var(--color-border)]">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('voucherTotals.sumEquiv', 'Sum (equiv.)')}</span>
                      <span className="ml-auto text-xs font-bold text-[var(--color-text-primary)] font-mono">{format(debitLines.reduce((sum, l) => sum + (parseFloat(l.equivalent as string) || 0), 0))}</span>
                    </div>
                    {isForeignVoucher && headerRate && headerRate > 1 && (
                      <div className="flex items-center gap-2 text-[10px] text-primary-500">
                        <span>÷ {formatCompact(headerRate)} =</span>
                        <span className="font-bold">{format(totalDebit)} {currency}</span>
                      </div>
                    )}
                  </div>

                  {/* Credit Section */}
                  <div>
                    <div className="text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase tracking-wider mb-1">
                      {t('voucherTotals.creditLines', 'Credit Lines')}
                    </div>
                    {renderLineBreakdown(creditLines, 'credit')}
                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-dashed border-[var(--color-border)]">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{t('voucherTotals.sumEquiv', 'Sum (equiv.)')}</span>
                      <span className="ml-auto text-xs font-bold text-[var(--color-text-primary)] font-mono">{format(creditLines.reduce((sum, l) => sum + (parseFloat(l.equivalent as string) || 0), 0))}</span>
                    </div>
                    {isForeignVoucher && headerRate && headerRate > 1 && (
                      <div className="flex items-center gap-2 text-[10px] text-primary-500">
                        <span>÷ {formatCompact(headerRate)} =</span>
                        <span className="font-bold">{format(totalCredit)} {currency}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Balance Status */}
              <div className={`flex items-center gap-2 text-[10px] font-bold px-2 py-1.5 rounded ${
                isBalanced 
                  ? 'bg-success-50 dark:bg-success-900/10 text-success-700 dark:text-success-400' 
                  : 'bg-danger-50 dark:bg-danger-900/10 text-danger-700 dark:text-danger-400'
              }`}>
                {isBalanced ? '✓' : '✗'} 
                {isBalanced 
                  ? t('voucherTotals.balanced', 'Balanced — Debit equals Credit in {{currency}}', { currency }) 
                  : t('voucherTotals.unbalanced', 'Unbalanced — {{amount}} {{currency}} difference', { amount: format(diff), currency })}
              </div>

              {/* Base Currency Note */}
              {baseCurrency && (
                <div className="flex items-start gap-2 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] rounded px-2.5 py-2 leading-relaxed">
                  <span className="mt-0.5 shrink-0">ℹ️</span>
                  <span>
                    {t('voucherTotals.baseNote', 'All vouchers affect the ledger in {{base}} (base currency) only.', { base: baseCurrency })}
                    {isForeignVoucher && (
                      <> {t('voucherTotals.convertedNote', 'Totals above are shown in {{currency}} for display.', { currency })}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {!isBalanced && hasValues && (
        <div className="flex items-center gap-1.5 px-2 text-[10px] font-bold text-danger-600 dark:text-danger-400 uppercase tracking-tight animate-pulse">
          <AlertTriangle size={12} strokeWidth={3} />
          {t('voucherTotals.unbalancedShort', 'Voucher Unbalanced: {{amount}} {{currency}} difference', { amount: diff.toFixed(2), currency })}
        </div>
      )}
    </div>
  );
};
