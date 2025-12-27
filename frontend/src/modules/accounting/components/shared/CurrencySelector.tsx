/**
 * Currency Selector Component
 * 
 * Direct text input for selecting currencies with smart auto-select and navigation.
 * - Type currency code directly (e.g. USD, EUR)
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, X } from 'lucide-react';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

// Standard list of currencies - typically this would come from an API or settings
const STANDARD_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
];

interface CurrencySelectorProps {
  value?: string;  // Currency code
  onChange: (currencyCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const CurrencySelector = forwardRef<HTMLInputElement, CurrencySelectorProps>(({
  value,
  onChange,
  placeholder = 'Cur...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown
}, ref) => {
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Sync input value with external value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
      modalInputRef.current.select();
    }
  }, [showModal]);

  // Find exact match by code
  const findExactMatch = (searchText: string): Currency | null => {
    const search = searchText.trim().toUpperCase();
    if (!search) return null;
    
    // Try exact code match
    const codeMatch = STANDARD_CURRENCIES.find(c => c.code === search);
    if (codeMatch) return codeMatch;
    
    return null;
  };

  // Find closest matches for modal
  const getFilteredCurrencies = (searchText: string): Currency[] => {
    const search = searchText.trim().toLowerCase();
    
    // If empty search, show all
    if (!search) return STANDARD_CURRENCIES;
    
    return STANDARD_CURRENCIES
      .filter(c => 
        c.code.toLowerCase().includes(search) || 
        c.name.toLowerCase().includes(search)
      )
      .sort((a, b) => {
        // Prioritize: exact code match > starts with > includes
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        
        if (aCode === search) return -1;
        if (bCode === search) return 1;
        if (aCode.startsWith(search) && !bCode.startsWith(search)) return -1;
        if (bCode.startsWith(search) && !aCode.startsWith(search)) return 1;
        
        return aCode.localeCompare(bCode);
      });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value.toUpperCase());
  };

  const handleInputBlur = () => {
    // If empty, just clear
    if (!inputValue.trim()) {
      if (value) onChange('');
      return;
    }

    // If matches current value, do nothing
    if (value && inputValue === value) {
      return;
    }

    const exactMatch = findExactMatch(inputValue);
    
    if (exactMatch) {
      // Found exact match
      onChange(exactMatch.code);
      setInputValue(exactMatch.code);
    } else {
      // No exact match - open modal
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Alt+Down to explicitly open modal
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
      return;
    }

    // Enter key handling
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        const exactMatch = findExactMatch(inputValue);
        if (exactMatch) {
          onChange(exactMatch.code);
          setInputValue(exactMatch.code);
          // Pass Enter to grid navigation
          if (externalKeyDown) externalKeyDown(e);
        } else {
            e.preventDefault(); 
            setModalSearch(inputValue.trim());
            setHighlightedIndex(0);
            setShowModal(true);
        }
      } else {
        // Empty input - pass Enter to grid
        if (externalKeyDown) externalKeyDown(e);
      }
      return;
    } 
    
    // Navigation keys - pass to grid
    const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    
    if (isNavKey) {
        if (externalKeyDown) {
            externalKeyDown(e);
            return;
        }
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    const filtered = getFilteredCurrencies(modalSearch);
    
    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filtered[highlightedIndex]) {
          handleSelectCurrency(filtered[highlightedIndex]);
        }
        e.preventDefault();
        break;
      case 'Escape':
        setShowModal(false);
        setInputValue(value || ''); // Revert to original
        inputRef.current?.focus();
        break;
    }
  };

  const handleSelectCurrency = (currency: Currency) => {
    onChange(currency.code);
    setInputValue(currency.code);
    setShowModal(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange('');
    setInputValue('');
    inputRef.current?.focus();
  };

  const filteredCurrencies = getFilteredCurrencies(modalSearch);

  return (
    <>
      {/* Input Field */}
      <div className={`relative flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full text-xs text-center font-bold ${noBorder ? 'p-1 border-none bg-transparent' : 'p-2 border border-gray-200 rounded bg-white'} 
            focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none
            ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
        />
      </div>

      {/* Search Modal */}
      {showModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 z-[9998]" 
            onClick={() => setShowModal(false)}
          />
          
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-64 max-h-[400px] pointer-events-auto">
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    ref={modalInputRef}
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleModalKeyDown}
                    placeholder="Search currency..."
                    className="flex-1 border-none outline-none text-sm uppercase"
                    autoFocus
                  />
                  <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>
              
              <div className="max-h-[300px] overflow-y-auto">
                {filteredCurrencies.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No currencies found</div>
                ) : (
                  filteredCurrencies.map((currency, index) => (
                    <div
                      key={currency.code}
                      onClick={() => handleSelectCurrency(currency)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm
                        ${index === highlightedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                        ${currency.code === value ? 'bg-indigo-100' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                         <span className="font-bold w-8">{currency.code}</span>
                         <span className="text-gray-500 text-xs">{currency.symbol}</span>
                      </div>
                      <span className="text-xs text-gray-500 truncate">{currency.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
});

CurrencySelector.displayName = 'CurrencySelector';

export default CurrencySelector;
