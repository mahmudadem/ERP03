/**
 * CompanyCurrencySettings
 * 
 * Settings component to enable/disable currencies for the company.
 * Shows global currencies and allows enabling with initial exchange rate.
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, X, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import { accountingApi, CurrencyDTO, CompanyCurrencyDTO } from '../../../../api/accountingApi';
import { errorHandler } from '../../../../services/errorHandler';

interface EnableCurrencyModalProps {
  currency: CurrencyDTO;
  baseCurrency: string;
  onClose: () => void;
  onEnabled: () => void;
}

const EnableCurrencyModal: React.FC<EnableCurrencyModalProps> = ({ 
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
        new Date().toISOString().split('T')[0]
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-[var(--color-bg-secondary)] rounded-xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
            Enable {currency.code}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-800 dark:text-blue-300">
                An initial exchange rate is required to enable this currency. 
                This rate will be used as the default for new transactions.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)] mb-2">
              Exchange Rate
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">1 {currency.code} =</span>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="0.0000"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-[var(--color-border)] dark:bg-[var(--color-bg-tertiary)] dark:text-[var(--color-text-primary)] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                autoFocus
              />
              <span className="text-sm text-gray-500">{baseCurrency}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-[var(--color-text-muted)]">
              {currency.decimalPlaces !== undefined && `${currency.code} uses ${currency.decimalPlaces} decimal places`}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[var(--color-text-secondary)] hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnable}
            disabled={saving || !rate}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <Check size={16} />
                Enable Currency
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CompanyCurrencySettings: React.FC = () => {
  const [globalCurrencies, setGlobalCurrencies] = useState<CurrencyDTO[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<CompanyCurrencyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [enableModalCurrency, setEnableModalCurrency] = useState<CurrencyDTO | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);

  // TODO: Get from company settings
  const baseCurrency = 'USD';

  const loadData = async () => {
    setLoading(true);
    try {
      const [globalRes, companyRes] = await Promise.all([
        accountingApi.getCurrencies(),
        accountingApi.getCompanyCurrencies(),
      ]);
      setGlobalCurrencies(globalRes.currencies || []);
      setCompanyCurrencies(companyRes.currencies || []);
    } catch (error) {
      console.error('Failed to load currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDisable = async (currencyCode: string) => {
    if (currencyCode === baseCurrency) {
      errorHandler.showError('Cannot disable base currency');
      return;
    }

    setDisabling(currencyCode);
    try {
      await accountingApi.disableCurrency(currencyCode);
      errorHandler.showSuccess(`${currencyCode} disabled`);
      loadData();
    } catch (error: any) {
      errorHandler.showError(error.message || 'Failed to disable currency');
    } finally {
      setDisabling(null);
    }
  };

  const enabledCodes = new Set(
    companyCurrencies.filter(c => c.isEnabled).map(c => c.currencyCode)
  );

  // Always include base currency
  const isEnabled = (code: string) => code === baseCurrency || enabledCodes.has(code);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-2">
          Company Currencies
        </h2>
        <p className="text-gray-600 dark:text-[var(--color-text-secondary)]">
          Enable currencies for use in vouchers. Each currency requires an initial exchange rate.
        </p>
      </div>

      {/* Base Currency Info */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
        <div className="flex items-center gap-3">
          <DollarSign className="text-emerald-600 dark:text-emerald-400" size={24} />
          <div>
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">
              Base Currency: {baseCurrency}
            </p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              All transactions are converted to this currency for reporting
            </p>
          </div>
        </div>
      </div>

      {/* Enabled Currencies */}
      <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)]">
          <h3 className="font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">
            Enabled Currencies ({enabledCodes.size + 1})
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-[var(--color-border)]">
          {/* Base currency first */}
          {globalCurrencies.filter(c => c.code === baseCurrency).map(currency => (
            <div key={currency.code} className="flex items-center justify-between px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10">
              <div className="flex items-center gap-3">
                <span className="text-lg">{currency.symbol}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)]">
                    {currency.code}
                    <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400 font-normal">(Base)</span>
                  </p>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">{currency.name}</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">{currency.decimalPlaces} decimals</span>
            </div>
          ))}

          {/* Enabled currencies */}
          {globalCurrencies.filter(c => c.code !== baseCurrency && enabledCodes.has(c.code)).map(currency => (
            <div key={currency.code} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]">
              <div className="flex items-center gap-3">
                <span className="text-lg">{currency.symbol}</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)]">{currency.code}</p>
                  <p className="text-sm text-gray-500 dark:text-[var(--color-text-secondary)]">{currency.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{currency.decimalPlaces} decimals</span>
                <button
                  onClick={() => handleDisable(currency.code)}
                  disabled={disabling === currency.code}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {disabling === currency.code ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    'Disable'
                  )}
                </button>
              </div>
            </div>
          ))}

          {enabledCodes.size === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 dark:text-[var(--color-text-muted)]">
              <p>No additional currencies enabled</p>
              <p className="text-sm mt-1">Enable currencies from the list below</p>
            </div>
          )}
        </div>
      </div>

      {/* Available Currencies */}
      <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-[var(--color-bg-secondary)] border-b border-gray-200 dark:border-[var(--color-border)]">
          <h3 className="font-semibold text-gray-900 dark:text-[var(--color-text-primary)]">
            Available Currencies ({globalCurrencies.length - enabledCodes.size - 1})
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
          {globalCurrencies.filter(c => !isEnabled(c.code)).map(currency => (
            <button
              key={currency.code}
              onClick={() => setEnableModalCurrency(currency)}
              className="flex items-center gap-3 p-3 border border-gray-200 dark:border-[var(--color-border)] rounded-lg hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left group"
            >
              <span className="text-lg">{currency.symbol}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-[var(--color-text-primary)] truncate">{currency.code}</p>
                <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)] truncate">{currency.name}</p>
              </div>
              <Plus size={18} className="text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
            </button>
          ))}

          {globalCurrencies.filter(c => !isEnabled(c.code)).length === 0 && (
            <div className="col-span-full text-center py-6 text-gray-500 dark:text-[var(--color-text-muted)]">
              All available currencies are enabled
            </div>
          )}
        </div>
      </div>

      {/* Enable Modal */}
      {enableModalCurrency && (
        <EnableCurrencyModal
          currency={enableModalCurrency}
          baseCurrency={baseCurrency}
          onClose={() => setEnableModalCurrency(null)}
          onEnabled={loadData}
        />
      )}
    </div>
  );
};
