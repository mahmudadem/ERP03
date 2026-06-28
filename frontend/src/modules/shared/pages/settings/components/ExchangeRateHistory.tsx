import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { History, User, Clock } from 'lucide-react';
import { Spinner } from '../../../../../components/ui/Spinner';
import { accountingApi } from '../../../../../api/accountingApi';
import { formatCompanyDate, formatCompanyTime } from '../../../../../utils/dateUtils';
import { useCompanySettings } from '../../../../../hooks/useCompanySettings';

export interface ExchangeRateHistoryRef {
  refresh: () => void;
}

export const ExchangeRateHistory = forwardRef<ExchangeRateHistoryRef>((_, ref) => {
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { settings } = useCompanySettings();
  const { t } = useTranslation('common');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await accountingApi.getExchangeRateHistory(undefined, undefined, 30);
      setRates(res.rates || []);
    } catch (e) {
      console.error('Failed to load history:', e);
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: loadHistory
  }));

  useEffect(() => { loadHistory(); }, []);

  if (loading && rates.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl">
        <Spinner variant="indigo" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-gray-50 dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)] flex items-center gap-2">
        <History size={18} className="text-gray-500" />
        <h3 className="font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">
          {t('currencySettings.recentOperations', { defaultValue: 'Recent Pricing Operations' })}
        </h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-[var(--color-border)] max-h-[400px] overflow-y-auto custom-scrollbar">
        {rates.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <Clock size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">{t('currencySettings.noOperations', { defaultValue: 'No pricing operations recorded' })}</p>
          </div>
        ) : (
          rates.map((rate, i) => (
            <div key={rate.id || i} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)] transition-colors group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-800/50">
                    {rate.fromCurrency} → {rate.toCurrency}
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                    {rate.rate.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <User size={10} />
                  <span>{rate.createdBy || t('common.system', { defaultValue: 'System' })}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="opacity-70">
                    {t('currencySettings.effectiveInline', { date: formatCompanyDate(rate.date, settings), defaultValue: 'Effective: {{date}}' })}
                  </span>
                  {rate.source === 'REFERENCE' && (
                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[9px] font-medium uppercase tracking-tight">
                      {t('currencySettings.reference', { defaultValue: 'Reference' })}
                    </span>
                  )}
                </div>
                <span className="opacity-40">
                  {formatCompanyDate(rate.createdAt, settings)} {formatCompanyTime(rate.createdAt, settings)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
ExchangeRateHistory.displayName = 'ExchangeRateHistory';
