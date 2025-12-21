/**
 * Account Selector Component
 * 
 * Autocomplete/dropdown for selecting accounts in voucher entry.
 * Only shows valid leaf accounts.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useAccounts, Account } from '../../../../context/AccountsContext';
import { Search, ChevronDown, X } from 'lucide-react';

interface AccountSelectorProps {
  value?: string;  // Account code
  onChange: (account: Account | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Select account...',
  disabled = false,
  className = ''
}) => {
  const { validAccounts, isLoading, getAccountByCode } = useAccounts();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected account from value
  const selectedAccount = value ? getAccountByCode(value) : null;

  // Filter accounts based on search
  const filteredAccounts = validAccounts.filter((account: Account) => {
    const search = searchTerm.toLowerCase();
    return (
      account.code.toLowerCase().includes(search) ||
      account.name.toLowerCase().includes(search)
    );
  });

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex(prev => Math.min(prev + 1, filteredAccounts.length - 1));
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filteredAccounts[highlightedIndex]) {
          handleSelect(filteredAccounts[highlightedIndex]);
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
    }
  };

  const handleSelect = (account: Account) => {
    onChange(account);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setHighlightedIndex(0);
    if (!isOpen) setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected value / Input */}
      <div
        className={`flex items-center w-full p-1 border border-gray-200 rounded bg-white text-xs cursor-pointer
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-indigo-300'}
          ${isOpen ? 'ring-1 ring-indigo-500 border-indigo-500' : ''}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <Search className="w-3 h-3 text-gray-400 mr-1 flex-shrink-0" />
        
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : placeholder}
            className="flex-1 outline-none bg-transparent text-xs"
            autoFocus
            disabled={disabled}
          />
        ) : (
          <span className={`flex-1 truncate ${selectedAccount ? 'text-gray-900' : 'text-gray-400'}`}>
            {selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : placeholder}
          </span>
        )}
        
        {selectedAccount && !disabled && (
          <X 
            className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-pointer mr-1" 
            onClick={handleClear}
          />
        )}
        
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-2 text-xs text-gray-500 text-center">Loading accounts...</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-2 text-xs text-gray-500 text-center">
              {searchTerm ? 'No accounts match your search' : 'No valid accounts available'}
            </div>
          ) : (
            filteredAccounts.map((account: Account, index: number) => (
              <div
                key={account.id}
                className={`px-2 py-1.5 cursor-pointer text-xs flex justify-between items-center
                  ${index === highlightedIndex ? 'bg-indigo-50' : 'hover:bg-gray-50'}
                  ${account.code === value ? 'bg-indigo-100' : ''}`}
                onClick={() => handleSelect(account)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className="font-medium text-gray-900">{account.code}</span>
                <span className="text-gray-500 truncate ml-2">{account.name}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AccountSelector;
