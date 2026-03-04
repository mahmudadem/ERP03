/**
 * CurrencyExchangeWidget
 *
 * Fetches exchange rates from the API and displays them.
 * - On initial load: auto-applies the system rate only when no meaningful value is saved.
 * - On currency change: ALWAYS auto-fetches and applies the new system rate.
 * - Refresh button: manually re-fetches the system rate and applies it.
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { accountingApi, RateDeviationWarning } from '../../../../api/accountingApi';

interface CurrencyExchangeWidgetProps {
  currency: string;
  value?: number;
  baseCurrency?: string;
  voucherDate?: string;
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

  // Track previous currency to detect user-initiated currency changes vs initial load
  const prevCurrencyRef = useRef<string>(currency);
  const isInitialMountRef = useRef(true);

  // ─── Core rate fetcher ────────────────────────────────────────────────────
  const fetchSystemRate = async (forceApply: boolean) => {
    const c1 = currency?.toUpperCase().trim() || '';
    const c2 = baseCurrency?.toUpperCase().trim() || '';

    if (!c1 || !c2) { setLoading(false); return; }

    if (c1 === c2) {
      setSuggestedRate(1);
      setRateSource('SAME_CURRENCY');
      setLoading(false);
      if (forceApply || !disabled && (value === undefined || value === null || Number(value) <= 0)) {
        setManualRate(1);
        onChange?.(1);
      }
      return;
    }

    setLoading(true);
    try {
      const response = await accountingApi.getSuggestedRate(c1, c2, voucherDate);
      setSuggestedRate(response.rate);
      setRateSource(response.source);

      const resolvedRate = response.rate;
      // Auto-apply when:
      //   forceApply = true (currency just changed by user, or refresh button clicked)
      //   OR no meaningful value exists on the form yet
      const noMeaningfulValue =
        value === undefined || value === null || Number(value) <= 0 ||
        (Number(value) === 1 && c1 !== c2);

      if (!disabled && resolvedRate !== null && (forceApply || noMeaningfulValue)) {
        setManualRate(resolvedRate as number);
        onChange?.(resolvedRate as number);
      }
    } catch (error) {
      console.warn('Failed to fetch exchange rate:', error);
      setSuggestedRate(null);
      setRateSource('ERROR');
    } finally {
      setLoading(false);
    }
  };

  // ─── Effect: fires on currency / baseCurrency / voucherDate change ────────
  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const currencyChanged = currency !== prevCurrencyRef.current;
      prevCurrencyRef.current = currency;

      // forceApply if: currency just changed (user switched it) but NOT on initial mount
      const forceApply = !isInitialMountRef.current && currencyChanged;
      isInitialMountRef.current = false;

      if (!mounted) return;
      await fetchSystemRate(forceApply);
    };

    run();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, baseCurrency, voucherDate]);

  // ─── Sync external value → internal state (e.g., parent resets the form) ──
  useEffect(() => {
    const effectiveRate = manualRate ?? suggestedRate ?? 1;
    if (value !== undefined && value !== effectiveRate) {
      setManualRate(value);
    }
  }, [value]);

  // ─── Deviation check ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const checkDeviation = async () => {
      if (!manualRate || manualRate <= 0 || currency === baseCurrency) {
        setWarnings([]);
        return;
      }
      try {
        const response = await accountingApi.checkRateDeviation(currency, baseCurrency, manualRate);
        if (mounted) setWarnings(response.warnings);
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(checkDeviation, 500);
    return () => { mounted = false; clearTimeout(timer); };
  }, [manualRate, currency, baseCurrency]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleManualRateChange = (newRate: number | string) => {
    const val = typeof newRate === 'string' ? (parseFloat(newRate) || undefined) : newRate;
    setManualRate(val);
  };

  const handleBlur = async () => {
    if (manualRate === undefined || manualRate <= 0) return;

    const percentageWarning = warnings.find(w => w.type === 'PERCENTAGE_DEVIATION');
    const deviationPercentage = percentageWarning?.percentageDeviation
      ? Math.abs(percentageWarning.percentageDeviation * 100) : 0;

    if (deviationPercentage >= 10) {
      setPendingRate(manualRate);
      setShowConfirmModal(true);
    } else {
      onChange?.(manualRate);
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchSystemRate(true); // forceApply = true → always overwrites current rate
  };

  const handleConfirmRate = () => {
    if (pendingRate !== null) { setManualRate(pendingRate); onChange?.(pendingRate); }
    setShowConfirmModal(false);
    setPendingRate(null);
  };

  const handleCancelRate = () => {
    setShowConfirmModal(false);
    setPendingRate(null);
    setManualRate(manualRate);
  };

  // ─── Derived display ──────────────────────────────────────────────────────
  const effectiveRate = manualRate ?? suggestedRate ?? null;
  const hasOverride = manualRate !== undefined && suggestedRate !== null && manualRate !== suggestedRate;
  const isMissingRate = effectiveRate === null && currency !== baseCurrency;

  const getStatusTooltip = () => {
    if (loading) return 'Fetching rate…';
    if (warnings.length > 0) return warnings.map(w => w.message).join('\n');
    if (rateSource === 'SAME_CURRENCY') return 'Same currency (1:1)';
    if (hasOverride) return 'Manual Override — click × to reset to system rate';
    if (rateSource === 'EXACT_DATE') return `System Rate for ${voucherDate || 'Date'}`;
    return 'System Rate (Last Known)';
  };

  const getStatusIcon = () => {
    if (loading) return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />;
    if (warnings.length > 0) return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    if (rateSource === 'SAME_CURRENCY') return <span className="text-xs font-bold text-gray-400">=</span>;
    if (hasOverride) return <div className="w-2 h-2 rounded-full bg-blue-500" />;
    return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
  };

  const isSameCurrency = currency?.toUpperCase() === baseCurrency?.toUpperCase();

  return (
    <>
      <div
        className={`
          flex items-center h-[32px] w-full border rounded overflow-hidden transition-all bg-[var(--color-bg-primary)]
          ${warnings.length > 0 ? 'border-amber-400 ring-1 ring-amber-100' :
            hasOverride ? 'border-primary-400 ring-1 ring-primary-50 dark:border-primary-600' :
            isMissingRate ? 'border-red-400 ring-1 ring-red-50' :
            'border-[var(--color-border)] hover:border-gray-400'}
          ${disabled ? 'opacity-75 cursor-not-allowed bg-gray-50' : ''}
        `}
        title={getStatusTooltip()}
      >
        {/* Left: 1 [CURRENCY] → */}
        <div className="flex items-center justify-center px-2 h-full bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] text-[10px] font-medium text-[var(--color-text-secondary)] whitespace-nowrap min-w-[60px]">
          1 {currency || '???'} <span className="opacity-50 mx-1">→</span>
        </div>

        {/* Middle: Input + Reset × button */}
        <div className="flex-1 relative h-full">
          <input
            type="number"
            step="0.0001"
            placeholder={loading ? '…' : (suggestedRate?.toFixed(4) || '0.00')}
            value={manualRate || ''}
            onChange={(e) => handleManualRateChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled || isSameCurrency}
            className={`
              w-full h-full px-2 text-xs font-semibold bg-transparent outline-none
              ${warnings.length > 0 ? 'text-amber-700 dark:text-amber-500' :
                hasOverride ? 'text-primary-700 dark:text-primary-400' :
                'text-[var(--color-text-primary)]'}
              placeholder:font-normal placeholder:text-gray-400
            `}
          />
          {/* Reset × — shown when user has overridden the rate */}
          {hasOverride && !disabled && (
            <button
              type="button"
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

        {/* Right: [BASE] + status icon + Refresh button */}
        <div className="flex items-center gap-1.5 px-2 h-full bg-[var(--color-bg-secondary)] border-l border-[var(--color-border)] min-w-[80px]">
          <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">
            {baseCurrency}
          </span>
          <div className="flex items-center gap-1">
            <div className="flex items-center justify-center" title={getStatusTooltip()}>
              {getStatusIcon()}
            </div>
            {/* Refresh button — always visible when not same-currency and not disabled */}
            {!isSameCurrency && !disabled && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center justify-center w-4 h-4 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-primary-600 transition-colors disabled:opacity-40"
                title="Refresh system rate"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
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
