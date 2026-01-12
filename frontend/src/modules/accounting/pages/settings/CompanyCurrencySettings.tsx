/**
 * CompanyCurrencySettings
 * 
 * Settings component to enable/disable currencies for the company.
 * Shows global currencies and allows enabling with initial exchange rate.
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, X, Check, Loader2, AlertCircle, Info } from 'lucide-react';
import { accountingApi, CurrencyDTO, CompanyCurrencyDTO } from '../../../../api/accountingApi';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { errorHandler } from '../../../../services/errorHandler';
import { ExchangeRateMatrix, ExchangeRateMatrixRef } from './components/ExchangeRateMatrix';
import { ExchangeRateHistory, ExchangeRateHistoryRef } from './components/ExchangeRateHistory';
import { PricingEntryForm } from './components/PricingEntryForm';
import { AvailableCurrenciesModal } from './components/AvailableCurrenciesModal';
import { EnableCurrencyModal } from './components/EnableCurrencyModal';

export const CompanyCurrencySettings: React.FC = () => {
  const [globalCurrencies, setGlobalCurrencies] = useState<CurrencyDTO[]>([]);
  const [companyCurrencies, setCompanyCurrencies] = useState<CompanyCurrencyDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [enableModalCurrency, setEnableModalCurrency] = useState<CurrencyDTO | null>(null);
  const [isAvailableModalOpen, setIsAvailableModalOpen] = useState(false);
  const [disabling, setDisabling] = useState<string | null>(null);
  const historyRef = React.useRef<ExchangeRateHistoryRef>(null);
  const matrixRef = React.useRef<ExchangeRateMatrixRef>(null);

  const { company } = useCompanyAccess();
  const baseCurrency = company?.baseCurrency || 'USD';

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

  const isEnabled = (code: string) => code === baseCurrency || enabledCodes.has(code);
  const availableToEnable = globalCurrencies.filter(c => !isEnabled(c.code));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-[var(--color-border)] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
            Currency Settings
          </h2>
          <p className="text-gray-500 dark:text-[var(--color-text-secondary)] mt-1">
            Manage your company's active currencies and exchange rates.
          </p>
        </div>
        
        <button
          onClick={() => setIsAvailableModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95"
        >
          <Plus size={18} />
          <span>Add New Currency</span>
        </button>
      </div>

      {/* Main Content Area: Two-Row Layout */}
      <div className="space-y-8">
        {/* Row 1: Three Columns - Responsive heights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 items-stretch">
          
          {/* Column 1: Active Currencies */}
          <section className="flex flex-col">
            <div className="bg-white dark:bg-[var(--color-bg-tertiary)] border border-gray-200 dark:border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
              <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-[var(--color-border)] flex-shrink-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-[var(--color-text-primary)]">
                  Active Currencies
                </h3>
              </div>
              
              <div className="divide-y divide-gray-100 dark:divide-[var(--color-border)] flex-1">
                {globalCurrencies.filter(c => isEnabled(c.code)).sort((a, b) => a.code === baseCurrency ? -1 : b.code === baseCurrency ? 1 : 0).map(currency => (
                  <div key={currency.code} className={`flex items-center justify-between px-5 py-4 transition-colors group ${currency.code === baseCurrency ? 'bg-emerald-50/20 dark:bg-emerald-900/5' : 'hover:bg-gray-50 dark:hover:bg-[var(--color-bg-secondary)]'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${currency.code === baseCurrency ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                        {currency.symbol}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{currency.code}</p>
                          {currency.code === baseCurrency && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 rounded-full">Base</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-[var(--color-text-secondary)]">{currency.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <span className="hidden sm:block text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{currency.decimalPlaces} Decimals</span>
                      {currency.code !== baseCurrency && (
                        <button
                          onClick={() => handleDisable(currency.code)}
                          disabled={disabling === currency.code}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
                          title="Disable Currency"
                        >
                          {disabling === currency.code ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <X size={16} strokeWidth={2.5} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Column 2: Manual Rate Entry */}
          <PricingEntryForm 
            enabledCurrencies={Array.from(enabledCodes)} 
            baseCurrency={baseCurrency} 
            onSuccess={() => {
              // Add a small delay to ensure backend has processed the save
              setTimeout(() => {
                historyRef.current?.refresh();
                matrixRef.current?.refresh();
              }, 500);
            }} 
          />

          {/* Column 3: Exchange Rate Matrix */}
          <ExchangeRateMatrix ref={matrixRef} />
        </div>

        {/* Row 2: Recent Pricing Operations (spans all 3 columns) */}
        <ExchangeRateHistory ref={historyRef} />
      </div>

      {/* Available Modal */}
      {isAvailableModalOpen && (
        <AvailableCurrenciesModal
          currencies={availableToEnable}
          onClose={() => setIsAvailableModalOpen(false)}
          onSelect={(currency) => {
            setIsAvailableModalOpen(false);
            setEnableModalCurrency(currency);
          }}
        />
      )}

      {/* Enable Modal */}
      {enableModalCurrency && (
        <EnableCurrencyModal
          currency={enableModalCurrency}
          baseCurrency={baseCurrency}
          onClose={() => setEnableModalCurrency(null)}
          onEnabled={() => {
            loadData();
            matrixRef.current?.refresh();
            historyRef.current?.refresh();
          }}
        />
      )}
    </div>
  );
};
