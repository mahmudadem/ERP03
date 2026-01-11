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
  currency = 'USD',
  value,
  baseCurrency = 'USD',
  voucherDate,
  onChange,
  disabled = false
}) => {
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<string>('NONE');
  const [loading, setLoading] = useState(false);
  const [manualRate, setManualRate] = useState<number | undefined>(value);
  const [warnings, setWarnings] = useState<RateDeviationWarning[]>([]);

  // Fetch suggested rate when currency changes
  useEffect(() => {
    let mounted = true;
    
    const fetchRate = async () => {
      // Same currency = rate of 1
      if (currency === baseCurrency) {
        setSuggestedRate(1);
        setRateSource('SAME_CURRENCY');
        setManualRate(undefined);
        onChange?.(1);
        return;
      }

      setLoading(true);
      try {
        const response = await accountingApi.getSuggestedRate(
          currency,
          baseCurrency,
          voucherDate
        );
        
        if (mounted) {
          setSuggestedRate(response.rate);
          setRateSource(response.source);
          setManualRate(undefined);
          
          // If we have a suggested rate, use it as default
          if (response.rate !== null && !value) {
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
    if (val !== undefined && val > 0) {
      onChange?.(val);
    }
  };

  const effectiveRate = manualRate ?? suggestedRate ?? null;
  const hasOverride = manualRate !== undefined && suggestedRate !== null && manualRate !== suggestedRate;
  const isMissingRate = effectiveRate === null && currency !== baseCurrency;

  return (
    <div className={`
      flex flex-col border rounded overflow-hidden transition-all shadow-sm
      ${isMissingRate ? 'border-warning-400 ring-1 ring-warning-100' : hasOverride ? 'border-primary-400 ring-1 ring-primary-100 dark:ring-primary-900/40' : 'border-[var(--color-border)]'}
      ${disabled ? 'bg-[var(--color-bg-secondary)] opacity-75' : 'bg-[var(--color-bg-primary)]'}
    `}>
      <div className="flex items-center">
        {/* 1. System/Reference Section */}
        <div className="flex-1 px-2.5 py-1.5 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50 min-w-[120px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-tighter">
              {rateSource === 'EXACT_DATE' ? 'Rate for Date' : rateSource === 'MOST_RECENT' ? 'Last Known' : 'Suggested'}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-text-secondary)]">
              <span>{baseCurrency}</span>
              <span className="opacity-30">→</span>
              <span>{currency}</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-[var(--color-text-primary)] mt-0.5 flex items-center gap-1">
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : suggestedRate !== null ? (
              suggestedRate.toFixed(4)
            ) : (
              <span className="text-warning-600">No rate available</span>
            )}
          </div>
        </div>

        {/* 2. Manual Input Section */}
        <div className="flex-[1.2] px-2.5 py-1.5 relative group bg-[var(--color-bg-primary)]">
          <label className={`
            absolute -top-1.5 left-2 px-1 text-[8px] font-bold uppercase tracking-widest transition-opacity
            ${isMissingRate ? 'text-warning-600 opacity-100 bg-[var(--color-bg-primary)]' : hasOverride ? 'text-primary-600 opacity-100 bg-[var(--color-bg-primary)]' : 'text-[var(--color-text-muted)] opacity-0'}
          `}>
            {isMissingRate ? 'Rate Required' : 'Manual Override'}
          </label>
          <div className="flex items-center gap-1.5 mt-0.5">
            <input
              type="number"
              step="0.0001"
              placeholder={suggestedRate?.toString() || 'Enter rate...'}
              value={manualRate || ''}
              onChange={(e) => handleManualRateChange(e.target.value)}
              disabled={disabled || currency === baseCurrency}
              className={`
                w-full bg-transparent text-xs font-bold outline-none placeholder:text-[var(--color-text-muted)] placeholder:font-normal
                ${isMissingRate ? 'text-warning-600' : hasOverride ? 'text-primary-600 dark:text-primary-400' : 'text-[var(--color-text-muted)]'}
              `}
            />
          </div>
        </div>

        {/* 3. Status Section */}
        <div className={`
          flex-1 px-2.5 py-1.5 transition-colors min-w-[130px]
          ${isMissingRate ? 'bg-warning-50/80 dark:bg-warning-900/20' : hasOverride ? 'bg-primary-50/80 dark:bg-primary-900/20' : 'bg-[var(--color-bg-primary)]'}
        `}>
          {isMissingRate ? (
            <div className="flex flex-col items-end">
              <div className="text-[9px] font-bold text-warning-600 uppercase leading-none flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Rate Required
              </div>
              <div className="text-[10px] text-warning-500 mt-1">
                Enter rate to save
              </div>
            </div>
          ) : hasOverride ? (
            <div className="flex flex-col items-end">
               <div className="text-[9px] font-bold text-primary-600 dark:text-primary-400 uppercase leading-none">Override Active</div>
               <button 
                  onClick={() => {
                    setManualRate(undefined);
                    if (suggestedRate) onChange?.(suggestedRate);
                  }}
                  className="text-[9px] font-bold text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 underline mt-1 transition-colors"
                >
                  Reset to System
                </button>
            </div>
          ) : (
            <div className="flex flex-col items-end">
              <div className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase leading-none">
                {currency === baseCurrency ? 'Same Currency' : 'System Rate'}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-success-500"></span>
                {currency === baseCurrency ? 'Rate = 1' : 'Active'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deviation Warnings */}
      {warnings.length > 0 && (
        <div className="px-2.5 py-1.5 bg-warning-50 dark:bg-warning-900/20 border-t border-warning-200">
          {warnings.map((warning, idx) => (
            <div key={idx} className="text-[10px] text-warning-700 dark:text-warning-400 flex items-start gap-1">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
