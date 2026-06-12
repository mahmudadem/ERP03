/**
 * Currency Selector Component (Updated)
 * 
 * Fetches currencies from API instead of using hardcoded list.
 * - Type currency code directly (e.g. USD, EUR)
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, ChevronDown, RefreshCw } from 'lucide-react';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';
import { useCompanyCurrencies, Currency } from '../../../../hooks/useCompanyCurrencies';
import { useSelectorModalFocus } from '../../../../components/shared/selectors/useSelectorModalFocus';

const FALLBACK_CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
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
  placeholder,
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur
}, ref) => {
  const { t } = useTranslation('accounting');
  const { data: currencies = [], isLoading, isError, refetch } = useCompanyCurrencies();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    showModal,
    () => setShowModal(false),
    inputRef
  );

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const { company } = useCompanyAccess();
  const baseCurrencyFromList = currencies.find(c => c.isBase)?.code;
  const baseCurrencyCode = baseCurrencyFromList || company?.baseCurrency || '';
  const currencyOptions = currencies.length > 0 ? currencies : FALLBACK_CURRENCIES;

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
    
    const codeMatch = currencyOptions.find(c => c.code === search);
    if (codeMatch) return codeMatch;
    
    return null;
  };

  // Find closest matches for modal
  const getFilteredCurrencies = (searchText: string): Currency[] => {
    const search = searchText.trim().toLowerCase();
    
    if (!search) return currencyOptions;
    
    return currencyOptions
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

  // Opens the centered search modal — used only to disambiguate typed text
  // that has no match or more than one match.
  const openPicker = (seed = inputValue) => {
    setModalSearch(seed.trim());
    const index = getFilteredCurrencies(seed).findIndex((currency) => currency.code === value);
    setHighlightedIndex(Math.max(0, index));
    setShowModal(true);
  };

  // Opens the inline dropdown (the chevron behaves like a normal <select>):
  // always lists every active currency, anchored under the input.
  const openDropdown = () => {
    if (disabled) return;
    const rect = inputRef.current?.getBoundingClientRect();
    if (rect) {
      setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    const index = currencyOptions.findIndex((c) => c.code === value);
    setHighlightedIndex(Math.max(0, index));
    setShowDropdown(true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return; // Guard: Do not allow changes when disabled
    setInputValue(e.target.value.toUpperCase());
  };

  const handleInputBlur = () => {
    // Always call external blur handler first
    if (externalBlur) {
      externalBlur();
    }
    
    // If disabled, do not process any changes
    if (disabled) {
      return;
    }
    
    if (!inputValue.trim()) {
      if (value) onChange('');
    } else if (value && inputValue === value) {
      // No change
    } else {
      const filtered = getFilteredCurrencies(inputValue);
      
      if (filtered.length === 1) {
        onChange(filtered[0].code);
        setInputValue(filtered[0].code);
      } else {
        openPicker(inputValue);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If disabled, only allow navigation but block all input
    if (disabled) {
      if (externalKeyDown) externalKeyDown(e);
      return;
    }

    // While the inline dropdown is open it captures arrow/Enter/Escape so it
    // behaves like a native <select>.
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, currencyOptions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const chosen = currencyOptions[highlightedIndex];
        if (chosen) handleSelectCurrency(chosen);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
      return;
    }

    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        const filtered = getFilteredCurrencies(inputValue);
        if (filtered.length === 1) {
          onChange(filtered[0].code);
          setInputValue(filtered[0].code);
          if (externalKeyDown) externalKeyDown(e);
        } else {
            e.preventDefault();
            openPicker();
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
      default:
        handleFocusTrapKeyDown(e);
        break;
    }
  };

  const handleRefresh = async () => {
    if (disabled || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh currencies', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSelectCurrency = (currency: Currency) => {
    onChange(currency.code);
    setInputValue(currency.code);
    setShowModal(false);
    setShowDropdown(false);
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
          onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('currencySelector.placeholder', { defaultValue: '...Cur' })}
          disabled={disabled}
          className={`w-full text-xs text-center font-bold uppercase transition-colors duration-200 ${noBorder ? 'border-0 bg-transparent p-1 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20' : 'p-2 pr-8 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)]'}
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {!disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => (showDropdown ? setShowDropdown(false) : openDropdown())}
            className="absolute right-1 inline-flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            title={t('currencySelector.open', 'Select currency')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Inline dropdown — opened by the chevron, lists every active currency */}
      {showDropdown && !disabled && dropdownRect && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div
            className="fixed z-50 max-h-60 overflow-y-auto custom-scroll rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] py-1 shadow-xl"
            style={{ top: dropdownRect.top, left: dropdownRect.left, minWidth: Math.max(dropdownRect.width, 200) }}
          >
            {currencyOptions.map((currency, index) => (
              <div
                key={currency.code}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectCurrency(currency)}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm transition-colors
                  ${index === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg-tertiary)]'}
                  ${currency.code === value ? 'border-l-2 border-primary-500' : 'border-l-2 border-transparent'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-10 font-bold text-[var(--color-text-primary)]">{currency.code}</span>
                  <span className="rounded bg-[var(--color-bg-secondary)] px-1 text-[10px] text-[var(--color-text-muted)]">{currency.symbol}</span>
                </div>
                <span className="ml-2 truncate text-xs text-[var(--color-text-secondary)]">{currency.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Search Modal */}
      {showModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40" 
            onClick={() => setShowModal(false)}
          />
          
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div
              ref={modalRef}
              tabIndex={-1}
              onKeyDown={handleModalKeyDown}
              className="bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] w-full max-w-[320px] max-h-[400px] pointer-events-auto flex flex-col transition-colors duration-300"
            >
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
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredCurrencies.length === 1) {
                        event.preventDefault();
                        handleSelectCurrency(filteredCurrencies[0]);
                      }
                    }}
                    placeholder={t('currencySelector.searchPlaceholder', { defaultValue: 'Search currency...' })}
                    className="flex-1 bg-transparent border-none outline-none text-sm uppercase text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isRefreshing || isLoading}
                    title={t('currencySelector.refresh', 'Refresh currencies')}
                    className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRefreshing || isLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)} 
                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scroll p-1">
                {filteredCurrencies.length === 0 ? (
                  <div className="p-4 text-center text-[var(--color-text-muted)] text-sm">
                    {t('currencySelector.noResults', { defaultValue: 'No currencies found' })}
                  </div>
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

