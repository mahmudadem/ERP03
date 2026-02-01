/**
 * CurrencyExchangeWidget (Updated)
 * 
 * Fetches exchange rates from API instead of using hardcoded mock rates.
 * Displays rate deviation warnings when detected.
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { accountingApi, RateDeviationWarning } from '../../../../api/accountingApi';

interface CurrencyExchangeWidgetProps {
  currency: string;
  value?: number; // Current exchange rate
  baseCurrency?: string;
  voucherDate?: string; // ISO date string for rate lookup
  onChange?: (rate: number) => void;
  disabled?: boolean;
}

export const CurrencyExchangeWidget: React.FC<CurrencyExchangeWidgetProps> = ({
  currency = '',
  value,
  baseCurrency = '',
  voucherDate,
  onChange,
  disabled = false
}) => {
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<string>('NONE');
  const [loading, setLoading] = useState(false);
  const [manualRate, setManualRate] = useState<number | undefined>(value);
  const [warnings, setWarnings] = useState<RateDeviationWarning[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingRate, setPendingRate] = useState<number | null>(null);

  // Fetch suggested rate when currency changes
  useEffect(() => {
    let mounted = true;
    
    const fetchRate = async () => {
      // Normalize currencies
      const c1 = currency?.toUpperCase().trim() || '';
      const c2 = baseCurrency?.toUpperCase().trim() || '';

      // Guard: Missing info
      if (!c1 || !c2) {
        setLoading(false);
        return;
      }

      // Same currency = rate of 1
      if (c1 === c2) {
        setSuggestedRate(1);
        setRateSource('SAME_CURRENCY');
        setManualRate(undefined);
        setLoading(false); // Ensure spinner stops
        onChange?.(1);
        return;
      }

      setLoading(true);
      try {
        const response = await accountingApi.getSuggestedRate(
          c1,
          c2,
          voucherDate
        );
        
        if (mounted) {
          setSuggestedRate(response.rate);
          setRateSource(response.source);
          setManualRate(undefined);
          
          // Always use suggested rate and update parent form
          if (response.rate !== null) {
            onChange?.(response.rate);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch exchange rate:', error);
        if (mounted) {
          setSuggestedRate(null);
          setRateSource('ERROR');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRate();
    return () => { mounted = false; };
  }, [currency, baseCurrency, voucherDate]);

  // Check for rate deviation when manual rate changes
  useEffect(() => {
    let mounted = true;

    const checkDeviation = async () => {
      if (!manualRate || manualRate <= 0 || currency === baseCurrency) {
        setWarnings([]);
        return;
      }

      try {
        const response = await accountingApi.checkRateDeviation(
          currency,
          baseCurrency,
          manualRate
        );
        if (mounted) {
          setWarnings(response.warnings);
        }
      } catch (error) {
        // Ignore deviation check errors
      }
    };

    const debounce = setTimeout(checkDeviation, 500);
    return () => { 
      mounted = false;
      clearTimeout(debounce);
    };
  }, [manualRate, currency, baseCurrency]);

  // Sync manual rate with external value
  useEffect(() => {
    const effectiveRate = manualRate ?? suggestedRate ?? 1;
    if (value !== undefined && value !== effectiveRate) {
      setManualRate(value);
    }
  }, [value]);

  const handleManualRateChange = (newRate: number | string) => {
    const val = typeof newRate === 'string' ? (parseFloat(newRate) || undefined) : newRate;
    setManualRate(val);
  };

  const effectiveRate = manualRate ?? suggestedRate ?? null;
  const hasOverride = manualRate !== undefined && suggestedRate !== null && manualRate !== suggestedRate;
  const isMissingRate = effectiveRate === null && currency !== baseCurrency;

  const handleBlur = async () => {
    if (manualRate === undefined || manualRate <= 0) {
      return;
    }

    // Check if this is a significant deviation (>10%)
    const percentageWarning = warnings.find(w => w.type === 'PERCENTAGE_DEVIATION');
    const deviationPercentage = percentageWarning?.percentageDeviation ? Math.abs(percentageWarning.percentageDeviation * 100) : 0;

    if (deviationPercentage >= 10) {
      // Show confirmation modal for significant deviations
      setPendingRate(manualRate);
      setShowConfirmModal(true);
    } else {
      // Small deviation or no deviation - apply immediately
      onChange?.(manualRate);
    }
  };

  const handleConfirmRate = () => {
    if (pendingRate !== null) {
      setManualRate(pendingRate);
      onChange?.(pendingRate);
    }
    setShowConfirmModal(false);
    setPendingRate(null);
  };

  const handleCancelRate = () => {
    setShowConfirmModal(false);
    setPendingRate(null);
    // Reset input to current value
    setManualRate(manualRate);
  };

  // Helper for status tooltip
  const getStatusTooltip = () => {
    if (loading) return 'Fetching rate...';
    if (warnings.length > 0) return warnings.map(w => w.message).join('\n');
    if (rateSource === 'SAME_CURRENCY') return 'Same currency (1:1)';
    if (hasOverride) return 'Manual Override (Click to reset)';
    if (rateSource === 'EXACT_DATE') return `System Rate for ${voucherDate || 'Date'}`;
    return `System Rate (Last Known)`;
  };

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />;
    if (warnings.length > 0) return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    if (rateSource === 'SAME_CURRENCY') return <span className="text-xs font-bold text-gray-400">=</span>;
    if (hasOverride) return <div className="w-2 h-2 rounded-full bg-blue-500" />;
    return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
  };

  return (
    <>
      <div 
        className={`
          flex items-center h-[32px] w-full border rounded overflow-hidden transition-all bg-[var(--color-bg-primary)]
          ${warnings.length > 0 ? 'border-amber-400 ring-1 ring-amber-100' : 
            hasOverride ? 'border-primary-400 ring-1 ring-primary-50 dark:border-primary-600' : 
            'border-[var(--color-border)] hover:border-gray-400'}
          ${disabled ? 'opacity-75 cursor-not-allowed bg-gray-50' : ''}
        `}
        title={getStatusTooltip()}
      >
        {/* Left: 1 [CURRENCY] = */}
        <div className="flex items-center justify-center px-2 h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-secondary)] whitespace-nowrap min-w-[60px]">
           1 {currency || '???'} <span className="opacity-50 mx-1">→</span>
        </div>

        {/* Middle: Input */}
        <div className="flex-1 relative h-full">
           <input
            type="number"
            step="0.0001"
            placeholder={loading ? '...' : (suggestedRate?.toFixed(4) || '0.00')}
            value={manualRate || ''}
            onChange={(e) => handleManualRateChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled || currency === baseCurrency}
            className={`
              w-full h-full px-2 text-xs font-semibold bg-transparent outline-none
              ${warnings.length > 0 ? 'text-amber-700 dark:text-amber-500' : 
                hasOverride ? 'text-primary-700 dark:text-primary-400' : 
                'text-[var(--color-text-primary)]'}
              placeholder:font-normal placeholder:text-gray-400
            `}
          />
           {/* Reset Button (only if override) - Absolute Right of Input */}
           {hasOverride && !disabled && (
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setManualRate(undefined);
                 if (suggestedRate) onChange?.(suggestedRate);
               }}
               className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
               title="Reset to System Rate"
             >
               <div className="w-3 h-3 flex items-center justify-center">×</div>
             </button>
           )}
        </div>

        {/* Right: [BASE] + Status */}
        <div className="flex items-center justify-between gap-1.5 px-2 h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] min-w-[70px]">
           <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">
             {baseCurrency}
           </span>
           <div className="flex items-center justify-center" title={getStatusTooltip()}>
             {getStatusIcon()}
           </div>
        </div>
      </div>

      {/* Confirmation Modal for Significant Deviations */}
      {showConfirmModal && pendingRate !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={handleCancelRate}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 max-w-sm mx-4 border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm">Review Rate</h3>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
              The rate <strong>{pendingRate}</strong> deviates significantly from the system rate ({suggestedRate}).
            </p>
            {warnings.map((w, i) => (
              <div key={i} className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded mb-3">
                {w.message}
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button onClick={handleCancelRate} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded text-gray-700">Cancel</button>
              <button onClick={handleConfirmRate} className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white rounded">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
