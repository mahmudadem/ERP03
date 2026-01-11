/**
 * Currency Selector Component (Updated)
 * 
 * Fetches currencies from API instead of using hardcoded list.
 * - Type currency code directly (e.g. USD, EUR)
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { accountingApi, CurrencyDTO } from '../../../../api/accountingApi';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
}

// Fallback currencies for when API is unavailable
const FALLBACK_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimalPlaces: 2 },
];

interface CurrencySelectorProps {
  value?: string;  // Currency code
  onChange: (currencyCode: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
}

export const CurrencySelector = forwardRef<HTMLInputElement, CurrencySelectorProps>(({
  value,
  onChange,
  placeholder = 'Cur...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur
}, ref) => {
  const [currencies, setCurrencies] = useState<Currency[]>(FALLBACK_CURRENCIES);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Fetch COMPANY-ENABLED currencies from API on mount
  // Only currencies that the company has enabled will appear
  useEffect(() => {
    let mounted = true;
    
    const fetchCurrencies = async () => {
      try {
        // Fetch company-enabled currencies (not global list)
        const response = await accountingApi.getCompanyCurrencies();
        if (mounted && response.currencies) {
          // Also fetch full currency details for the enabled ones
          const globalResponse = await accountingApi.getCurrencies();
          const globalMap = new Map(
            globalResponse.currencies?.map((c: CurrencyDTO) => [c.code, c]) || []
          );
          
          // Map enabled currencies to full details
          const enabledCurrencies = response.currencies
            .filter((cc: any) => cc.isEnabled)
            .map((cc: any) => {
              const full = globalMap.get(cc.currencyCode);
              return full ? {
                code: full.code,
                name: full.name,
                symbol: full.symbol,
                decimalPlaces: full.decimalPlaces,
              } : {
                code: cc.currencyCode,
                name: cc.currencyCode,
                symbol: cc.currencyCode,
                decimalPlaces: 2,
              };
            });
          
          setCurrencies(enabledCurrencies.length > 0 ? enabledCurrencies : FALLBACK_CURRENCIES);
        }
      } catch (error) {
        console.warn('Failed to fetch company currencies, using fallback:', error);
        // Keep fallback currencies
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchCurrencies();
    return () => { mounted = false; };
  }, []);

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
    
    const codeMatch = currencies.find(c => c.code === search);
    if (codeMatch) return codeMatch;
    
    return null;
  };

  // Find closest matches for modal
  const getFilteredCurrencies = (searchText: string): Currency[] => {
    const search = searchText.trim().toLowerCase();
    
    if (!search) return currencies;
    
    return currencies
      .filter(c => 
        c.code.toLowerCase().includes(search) || 
        c.name.toLowerCase().includes(search)
      )
      .sort((a, b) => {
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
    if (!inputValue.trim()) {
      if (value) onChange('');
    } else if (value && inputValue === value) {
      // No change
    } else {
      const exactMatch = findExactMatch(inputValue);
      
      if (exactMatch) {
        onChange(exactMatch.code);
        setInputValue(exactMatch.code);
      } else {
        setHighlightedIndex(0);
        setShowModal(true);
      }
    }

    if (externalBlur) {
      externalBlur();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
      return;
    }

    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        const exactMatch = findExactMatch(inputValue);
        if (exactMatch) {
          onChange(exactMatch.code);
          setInputValue(exactMatch.code);
          if (externalKeyDown) externalKeyDown(e);
        } else {
            e.preventDefault(); 
            setModalSearch(inputValue.trim());
            setHighlightedIndex(0);
            setShowModal(true);
        }
      } else {
        if (externalKeyDown) externalKeyDown(e);
      }
      return;
    } 
    
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
        setInputValue(value || '');
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
          disabled={disabled || loading}
          className={`w-full text-xs text-center font-bold transition-colors duration-200 ${noBorder ? 'p-1 border-none bg-transparent' : 'p-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)]'} 
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {loading && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-[var(--color-text-muted)]" />}
      </div>

      {/* Search Modal */}
      {showModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[9998]" 
            onClick={() => setShowModal(false)}
          />
          
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] w-full max-w-[280px] max-h-[400px] pointer-events-auto flex flex-col transition-colors duration-300">
              <div className="p-3 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
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
                    className="flex-1 bg-transparent border-none outline-none text-sm uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                  />
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scroll p-1">
                {filteredCurrencies.length === 0 ? (
                  <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">No currencies found</div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredCurrencies.map((currency, index) => (
                      <div
                        key={currency.code}
                        onClick={() => handleSelectCurrency(currency)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-3 py-2 cursor-pointer flex justify-between items-center text-sm rounded-md transition-colors
                          ${index === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg-tertiary)]'}
                          ${currency.code === value ? 'border-l-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/30' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                           <span className="font-bold w-10 text-[var(--color-text-primary)]">{currency.code}</span>
                           <span className="text-[var(--color-text-muted)] text-[10px] bg-[var(--color-bg-secondary)] px-1 rounded">{currency.symbol}</span>
                        </div>
                        <span className="text-xs text-[var(--color-text-secondary)] truncate ml-2">{currency.name}</span>
                      </div>
                    ))}
                  </div>
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
