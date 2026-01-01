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

interface CurrencyExchangeData {
  currency: string;
  exchangeRate: number;
}

interface CurrencyExchangeWidgetProps {
  value?: CurrencyExchangeData;
  baseCurrency?: string;
  onChange?: (value: CurrencyExchangeData) => void;
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
  value = { currency: 'USD', exchangeRate: 1 },
  baseCurrency = 'USD',
  onChange,
  disabled = false
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState(value.currency);
  const [rate, setRate] = useState(value.exchangeRate);

  // Auto-fetch exchange rate when currency changes
  useEffect(() => {
    if (selectedCurrency === baseCurrency) {
      // Same currency = rate 1
      setRate(1);
      onChange?.({ currency: selectedCurrency, exchangeRate: 1 });
    } else {
      // Fetch rate from API (mocked here)
      const rateKey = `${baseCurrency}-${selectedCurrency}`;
      const fetchedRate = EXCHANGE_RATES[rateKey] || 1;
      
      setRate(fetchedRate);
      onChange?.({ currency: selectedCurrency, exchangeRate: fetchedRate });
    }
  }, [selectedCurrency, baseCurrency, onChange]);

  const handleCurrencyChange = (newCurrency: string) => {
    setSelectedCurrency(newCurrency);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    onChange?.({ currency: selectedCurrency, exchangeRate: newRate });
  };

  const baseCurrencyInfo = CURRENCIES.find(c => c.code === baseCurrency);
  const selectedCurrencyInfo = CURRENCIES.find(c => c.code === selectedCurrency);

  return (
    <div className="space-y-2">
      {/* Currency Selector */}
      <div className="relative">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
          Currency
        </label>
        <select
          value={selectedCurrency}
          onChange={(e) => handleCurrencyChange(e.target.value)}
          disabled={disabled}
          className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm appearance-none pr-6"
        >
          {CURRENCIES.map(curr => (
            <option key={curr.code} value={curr.code}>
              {curr.code} - {curr.name}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-8 text-gray-400 pointer-events-none" size={14} />
      </div>

      {/* Exchange Rate Display & Edit */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">
            Exchange Rate
          </label>
          <input
            type="number"
            step="0.0001"
            value={rate}
            onChange={(e) => handleRateChange(parseFloat(e.target.value) || 1)}
            disabled={disabled}
            className="w-full p-1.5 border border-gray-200 rounded bg-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none shadow-sm"
          />
        </div>
        
        {/* Conversion Display */}
        <div className="flex-1 pt-5">
          <div className="p-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
            1 {baseCurrencyInfo?.symbol}{baseCurrency} = {rate.toFixed(4)} {selectedCurrencyInfo?.symbol}{selectedCurrency}
          </div>
        </div>
      </div>

      {/* Visual Indicator */}
      {selectedCurrency !== baseCurrency && (
        <div className="text-[10px] text-indigo-600 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          Rate auto-fetched
        </div>
      )}
    </div>
  );
};
