/**
 * Account Selector Component
 * 
 * Direct text input with smart auto-select:
 * - Type account code/name directly
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal with closest matches
 */

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useAccounts, Account } from '../../../../context/AccountsContext';
import { Search, X } from 'lucide-react';

interface AccountSelectorProps {
  value?: string;  // Account code
  onChange: (account: Account | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

export const AccountSelector = forwardRef<HTMLInputElement, AccountSelectorProps>(({
  value,
  onChange,
  placeholder = 'Account code...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown
}, ref) => {
  const { validAccounts, isLoading, getAccountByCode } = useAccounts();
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
    if (value) {
      const account = getAccountByCode(value);
      setInputValue(account ? `${account.code} - ${account.name}` : value);
    } else {
      setInputValue('');
    }
  }, [value, getAccountByCode]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
      modalInputRef.current.select();
    }
  }, [showModal]);

  // Find exact match by code or name
  const findExactMatch = (searchText: string): Account | null => {
    const search = searchText.trim().toLowerCase();
    if (!search) return null;
    
    // Try exact code match first
    const codeMatch = validAccounts.find((a: Account) => a.code.toLowerCase() === search);
    if (codeMatch) return codeMatch;
    
    // Try exact name match
    const nameMatch = validAccounts.find((a: Account) => a.name.toLowerCase() === search);
    if (nameMatch) return nameMatch;
    
    return null;
  };

  // Find closest matches for modal
  const getFilteredAccounts = (searchText: string): Account[] => {
    const search = searchText.trim().toLowerCase();
    if (!search) return validAccounts.slice(0, 20); // Show first 20 if no search
    
    return validAccounts
      .filter((a: Account) => 
        a.code.toLowerCase().includes(search) || 
        a.name.toLowerCase().includes(search)
      )
      .sort((a, b) => {
        // Prioritize: exact match > starts with > includes
        const aCode = a.code.toLowerCase();
        const bCode = b.code.toLowerCase();
        
        if (aCode === search) return -1;
        if (bCode === search) return 1;
        if (aCode.startsWith(search) && !bCode.startsWith(search)) return -1;
        if (bCode.startsWith(search) && !aCode.startsWith(search)) return 1;
        
        return aCode.localeCompare(bCode);
      })
      .slice(0, 20);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    // If empty, just clear
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    // If input matches the current selected account's display text, do nothing
    if (value) {
      const currentAccount = getAccountByCode(value);
      if (currentAccount && inputValue === `${currentAccount.code} - ${currentAccount.name}`) {
        return; 
      }
    }

    // Try to find exact match
    const exactMatch = findExactMatch(inputValue);
    
    if (exactMatch) {
      // Found exact match - update selection
      if (exactMatch.code !== value) {
         onChange(exactMatch);
      }
      setInputValue(`${exactMatch.code} - ${exactMatch.name}`);
    } else {
      // Logic for partial/no match
      // If the input looks like a code (digits), keep it as is maybe? 
      // Or just revert if it was valid before?
      // For now: open modal to resolve
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Alt+Down to explicitly open modal - stop propagation
    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setModalSearch(inputValue.trim());
      setHighlightedIndex(0);
      setShowModal(true);
      return;
    }

    // Enter key handling
    if (e.key === 'Enter') {
      // If we have text, try to resolve it locally first
      if (inputValue.trim()) {
        const exactMatch = findExactMatch(inputValue);
        if (exactMatch) {
          // Exact match found - select it
          onChange(exactMatch);
          setInputValue(`${exactMatch.code} - ${exactMatch.name}`);
          // Pass Enter to grid navigation
          if (externalKeyDown) externalKeyDown(e);
        } else {
            // No exact match - open modal
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
    
    // NAVIGATION KEYS - CRITICAL FOR GRID
    // Always pass these to the grid handler unless we are doing something specific
    const isNavKey = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
    
    if (isNavKey) {
        // Only consume ArrowDown if we want it to open the modal (optional behavior)
        // But user request says "move from/to", so let's PRIORITIZE GRID NAVIGATION
        
        // Pass to external handler
        if (externalKeyDown) {
            externalKeyDown(e);
            return;
        }
    }
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    const filtered = getFilteredAccounts(modalSearch);
    
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
          handleSelectAccount(filtered[highlightedIndex]);
        }
        e.preventDefault();
        break;
      case 'Escape':
        setShowModal(false);
        inputRef.current?.focus();
        break;
    }
  };

  const handleSelectAccount = (account: Account) => {
    onChange(account);
    setInputValue(`${account.code} - ${account.name}`);
    setShowModal(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  const filteredAccounts = getFilteredAccounts(modalSearch);

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
          className={`w-full text-xs transition-colors duration-200 ${noBorder ? 'p-1 border-none bg-transparent' : 'p-2 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)]'} 
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {inputValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-1 p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Search Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[9998]" 
            onClick={() => setShowModal(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow-2xl border border-[var(--color-border)] w-full max-w-md max-h-[450px] pointer-events-auto flex flex-col transition-colors duration-300">
              {/* Header */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <Search className="w-5 h-5 text-[var(--color-text-muted)]" />
                  <input
                    ref={modalInputRef}
                    type="text"
                    value={modalSearch}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleModalKeyDown}
                    placeholder="Search accounts..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                  />
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
                  </button>
                </div>
              </div>
              
              {/* Results */}
              <div className="flex-1 overflow-y-auto custom-scroll p-1">
                {isLoading ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-sm flex flex-col items-center gap-3">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    Loading accounts...
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">No accounts found</div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        onClick={() => handleSelectAccount(account)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-4 py-3 cursor-pointer flex justify-between items-center text-sm rounded-md transition-colors
                          ${index === highlightedIndex ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg-tertiary)]'}
                          ${account.code === value ? 'border-l-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/30' : ''}`}
                      >
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--color-text-primary)]">{account.code}</span>
                          <span className="text-xs text-[var(--color-text-secondary)] truncate">{account.name}</span>
                        </div>
                        {account.code === value && (
                           <div className="w-2 h-2 rounded-full bg-primary-500 shadow-sm shadow-primary-500/50" />
                        )}
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

AccountSelector.displayName = 'AccountSelector';

export default AccountSelector;
