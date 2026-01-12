import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Save, Loader2, TrendingUp, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import { accountingApi } from '../../../../../api/accountingApi';
import { errorHandler } from '../../../../../services/errorHandler';

interface PricingEntryFormProps {
  enabledCurrencies: string[];
  baseCurrency: string;
  onSuccess: () => void;
}

export const PricingEntryForm: React.FC<PricingEntryFormProps> = ({ enabledCurrencies, baseCurrency, onSuccess }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(baseCurrency);
  const [rate, setRate] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [deviation, setDeviation] = useState<{ percentage: number; warnings: any[] } | null>(null);
  const [suggestedRate, setSuggestedRate] = useState<number | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ from: string; to: string; rate: number; date: string } | null>(null);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for inverse rate suggestion when FROM/TO changes
  useEffect(() => {
    const fetchInverseRateSuggestion = async () => {
      if (from && to && from !== to) {
        setLoadingSuggestion(true);
        try {
          const response = await accountingApi.getLatestRatesMatrix();
          const matrix = response.matrix;
          // Check if the reverse rate exists (TO → FROM)
          if (matrix[to] && matrix[to][from]) {
            const reverseRate = matrix[to][from];
            const suggestedInverse = 1 / reverseRate;
            setSuggestedRate(suggestedInverse);
            
            // Auto-fill the rate if it's empty
            if (!rate) {
              setRate(suggestedInverse.toFixed(4));
            }
          } else {
            setSuggestedRate(null);
          }
        } catch (err) {
          console.error('Error fetching rate suggestion:', err);
          setSuggestedRate(null);
        } finally {
          setLoadingSuggestion(false);
        }
      } else {
        setSuggestedRate(null);
      }
    };

    fetchInverseRateSuggestion();
  }, [from, to]); // Only run when FROM or TO changes, not when rate changes

  // Check for rate deviation when rate changes
  useEffect(() => {
    if (from && to && rate && parseFloat(rate) > 0 && from !== to) {
      // Clear previous timeout
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      // Debounce the API call
      checkTimeoutRef.current = setTimeout(async () => {
        setChecking(true);
        try {
          const result = await accountingApi.checkRateDeviation(from, to, parseFloat(rate));
          if (result.hasWarnings && result.warnings.length > 0) {
            const percentageWarning = result.warnings.find((w: any) => w.type === 'PERCENTAGE_DEVIATION');
            if (percentageWarning) {
              setDeviation({
                percentage: Math.abs(percentageWarning.percentageDeviation || 0) * 100, // Convert decimal to percentage
                warnings: result.warnings
              });
            } else {
              setDeviation(null);
            }
          } else {
            setDeviation(null);
          }
        } catch (err) {
          console.error('Error checking rate deviation:', err);
          setDeviation(null);
        } finally {
          setChecking(false);
        }
      }, 500); // 500ms debounce
    } else {
      setDeviation(null);
    }

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [from, to, rate]);

  const getDeviationColor = (percentage: number) => {
    if (percentage < 10) return { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/30', text: 'text-green-900 dark:text-green-100', icon: 'text-green-600' };
    if (percentage < 50) return { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800/30', text: 'text-yellow-900 dark:text-yellow-100', icon: 'text-yellow-600' };
    return { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800/30', text: 'text-red-900 dark:text-red-100', icon: 'text-red-600' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!from || !to || !rate || from === to) {
      return;
    }

    // If there's a significant deviation (>10%), show confirmation modal
    if (deviation && deviation.percentage >= 10) {
      setPendingSave({ from, to, rate: parseFloat(rate), date });
      setShowConfirmModal(true);
      return;
    }

    // No deviation warning needed, proceed directly
    await performSave(from, to, parseFloat(rate), date);
  };

  const performSave = async (fromCurr: string, toCurr: string, rateValue: number, dateValue: string) => {
    setSaving(true);
    try {
      await accountingApi.saveExchangeRate(fromCurr, toCurr, rateValue, dateValue);
      errorHandler.showSuccess(`Rate updated: 1 ${fromCurr} = ${rateValue} ${toCurr}`);
      setRate('');
      setDate(new Date().toISOString().split('T')[0]); // Reset to today
      setDeviation(null);
      onSuccess();
    } catch (err: any) {
      errorHandler.showError(err.message || 'Failed to save rate');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    if (pendingSave) {
      await performSave(pendingSave.from, pendingSave.to, pendingSave.rate, pendingSave.date);
      setPendingSave(null);
    }
  };

  const handleCancelSave = () => {
    setShowConfirmModal(false);
    setPendingSave(null);
  };

  const allCodes = Array.from(new Set([baseCurrency, ...enabledCurrencies])).sort();

  const colors = deviation ? getDeviationColor(deviation.percentage) : { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-100 dark:border-indigo-800/30', text: 'text-indigo-900 dark:text-indigo-100', icon: 'text-indigo-600' };

  return (
    <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-6 flex items-center gap-2">
        <TrendingUp size={16} className="text-indigo-600" />
        Manual Rate Entry
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Row 1: Currency Selection */}
        <div className="grid grid-cols-1 md:grid-cols-7 items-end gap-3">
          <div className="md:col-span-3">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">From</label>
            <select 
              value={from} 
              onChange={e => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-secondary)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            >
              <option value="">Select...</option>
              {allCodes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-1 flex items-center justify-center pb-2.5">
             <ArrowRight size={16} className="text-gray-400" />
          </div>

          <div className="md:col-span-3">
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">To</label>
            <select 
              value={to} 
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-secondary)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            >
              {allCodes.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date and Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
              Effective Date
            </label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-secondary)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1.5">
              Rate
            </label>
            <div className="relative">
              <input 
                type="number" 
                step="0.0001" 
                min="0"
                value={rate} 
                onChange={e => setRate(e.target.value)}
                placeholder="0.0000"
                className="w-full pl-3 pr-12 py-2 border border-gray-200 dark:border-[var(--color-border)] bg-gray-50 dark:bg-[var(--color-bg-secondary)] rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{to}</span>
            </div>
            {suggestedRate && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Lightbulb size={12} />
                <span>Suggested inverse: {suggestedRate.toFixed(4)} (from {to}→{from})</span>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview with Deviation Warning */}
        {from && to && rate && parseFloat(rate) > 0 && from !== to && (
          <div className={`flex items-center justify-between py-3 px-4 ${colors.bg} border ${colors.border} rounded-lg transition-all`}>
            <div className="flex items-center gap-2">
              {checking ? (
                <Loader2 size={16} className={`${colors.icon} animate-spin`} />
              ) : deviation ? (
                deviation.percentage >= 50 ? <AlertTriangle size={16} className={colors.icon} /> :
                deviation.percentage >= 10 ? <AlertTriangle size={16} className={colors.icon} /> :
                <CheckCircle size={16} className={colors.icon} />
              ) : (
                <CheckCircle size={16} className={colors.icon} />
              )}
              <p className={`text-sm font-bold ${colors.text}`}>
                1 {from} = {parseFloat(rate).toFixed(4)} {to}
                <span className="ml-3 text-xs font-normal opacity-70">
                  (Effective: {new Date(date).toLocaleDateString()})
                </span>
              </p>
            </div>
            {deviation && (
              <span className={`text-xs font-bold ${colors.text} opacity-80`}>
                {deviation.percentage >= 50 ? '⚠️ ' : deviation.percentage >= 10 ? '⚠ ' : '✓ '}
                {deviation.percentage.toFixed(1)}% change
              </span>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-[var(--color-border)]/50 mt-4">
          <button 
            type="submit"
            disabled={saving || !from || !to || !rate || from === to || parseFloat(rate) <= 0}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50 disabled:grayscale shadow-md hover:shadow-lg active:scale-95"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>Update Reference Rate</span>
          </button>
        </div>
      </form>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && deviation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancelSave}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle size={24} className="text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Rate Deviation Warning
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  The rate you entered <strong>({pendingSave?.rate.toFixed(4)})</strong> differs by{' '}
                  <strong className="text-yellow-600">{deviation.percentage.toFixed(1)}%</strong> from the most recent rate.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  This could be a typing mistake. Are you sure you want to save this rate?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleCancelSave}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmSave}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-all font-medium flex items-center gap-2"
                  >
                    <Save size={16} />
                    Save Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
