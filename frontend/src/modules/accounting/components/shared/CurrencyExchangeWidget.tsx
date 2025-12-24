/**
 * CurrencyExchangeWidget
 * 
 * Smart component that combines currency selection + exchange rate.
 * Automatically fetches exchange rates and displays conversion.
 * 
 * This is an example of a reusable component for the component library.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CurrencyExchangeWidgetProps {
  currency: string;
  value?: number; // Current exchange rate
  baseCurrency?: string;
  onChange?: (rate: number) => void;
  disabled?: boolean;
}

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

// Mock exchange rates (in production, fetch from API)
const EXCHANGE_RATES: Record<string, number> = {
  'USD-EUR': 0.92,
  'USD-TRY': 32.5,
  'USD-GBP': 0.79,
  'EUR-USD': 1.09,
  'EUR-TRY': 35.3,
  'EUR-GBP': 0.86,
  'TRY-USD': 0.031,
  'TRY-EUR': 0.028,
  'TRY-GBP': 0.024,
  'GBP-USD': 1.27,
  'GBP-EUR': 1.16,
  'GBP-TRY': 41.1,
};

export const CurrencyExchangeWidget: React.FC<CurrencyExchangeWidgetProps> = ({
  currency = 'USD',
  value,
  baseCurrency = 'USD',
  onChange,
  disabled = false
}) => {
  const [systemRate, setSystemRate] = useState(1);
  const [manualRate, setManualRate] = useState<number | undefined>(value);

  // Auto-fetch system rate when currency changes
  // FIX: Also reset manualRate when currency changes to avoid stale overrides!
  useEffect(() => {
    setManualRate(undefined); // Reset override on currency change
    
    if (currency === baseCurrency) {
      setSystemRate(1);
    } else {
      const rateKey = `${baseCurrency}-${currency}`;
      const fetchedRate = EXCHANGE_RATES[rateKey] || 1;
      setSystemRate(fetchedRate);
    }
  }, [currency, baseCurrency]);

  // Handle manual rate change
  const handleManualRateChange = (newRate: number | string) => {
    const val = typeof newRate === 'string' ? (parseFloat(newRate) || undefined) : newRate;
    setManualRate(val);
    onChange?.(val ?? systemRate);
  };

  // Sync manual rate with value if it changes externally
  useEffect(() => {
    if (value !== undefined && value !== (manualRate ?? systemRate)) {
      setManualRate(value);
    }
  }, [value, systemRate]);

  const baseCurrencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
  const selectedCurrencyInfo = CURRENCIES.find(c => c.code === currency);

  const hasOverride = manualRate !== undefined && manualRate !== systemRate;

  return (
    <div className={`
      flex items-center border rounded overflow-hidden transition-all shadow-sm
      ${hasOverride ? 'border-indigo-400 ring-1 ring-indigo-100' : 'border-gray-200'}
      ${disabled ? 'bg-gray-50 opacity-75' : 'bg-white'}
    `}>
      {/* 1. System/Reference Section */}
      <div className="flex-1 px-2.5 py-1.5 border-r border-gray-100 bg-gray-50/50 min-w-[120px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">System Rate</span>
          <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
            <span>{baseCurrency}</span>
            <span className="opacity-30">→</span>
            <span>{currency}</span>
          </div>
        </div>
        <div className="text-xs font-semibold text-gray-600 mt-0.5">
          {systemRate.toFixed(4)}
        </div>
      </div>

      {/* 2. Manual Input Section */}
      <div className="flex-[1.2] px-2.5 py-1.5 relative group">
        <label className={`
          absolute -top-1.5 left-2 px-1 text-[8px] font-bold uppercase tracking-widest transition-opacity
          ${hasOverride ? 'text-indigo-600 opacity-100 bg-white' : 'text-gray-400 opacity-0'}
        `}>
          Manual Override
        </label>
        <div className="flex items-center gap-1.5 mt-0.5">
          <input
            type="number"
            step="0.0001"
            placeholder={systemRate.toString()}
            value={manualRate || ''}
            onChange={(e) => handleManualRateChange(e.target.value)}
            disabled={disabled}
            className={`
              w-full bg-transparent text-xs font-bold outline-none placeholder:text-gray-300 placeholder:font-normal
              ${hasOverride ? 'text-indigo-700' : 'text-gray-400'}
            `}
          />
          {!hasOverride && (
            <div className="text-[9px] font-bold text-gray-300 pointer-events-none uppercase tracking-tighter">Enter...</div>
          )}
        </div>
      </div>

      {/* 3. Status/Reset Section */}
      <div className={`
        flex-1 px-2.5 py-1.5 transition-colors min-w-[130px]
        ${hasOverride ? 'bg-indigo-50/80' : 'bg-white'}
      `}>
        {hasOverride ? (
          <div className="flex flex-col items-end">
             <div className="text-[9px] font-bold text-indigo-600 uppercase leading-none">Override Active</div>
             <button 
                onClick={() => handleManualRateChange(systemRate)}
                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-700 underline mt-1 transition-colors"
              >
                Reset to System
              </button>
          </div>
        ) : (
          <div className="flex flex-col items-end">
            <div className="text-[9px] font-bold text-gray-300 uppercase leading-none">No Override</div>
            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-400"></span>
              Live Tracking
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
