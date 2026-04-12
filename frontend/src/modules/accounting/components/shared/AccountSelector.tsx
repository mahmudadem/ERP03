/**
 * Account Selector Component
 * 
 * Direct text input with smart auto-select:
 * - Type account code/name directly
 * - Exact match: auto-selects on blur/Enter
 * - No exact match: opens search modal with closest matches
 */
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts, Account } from '../../../../context/AccountsContext';
import { Search, X, Plus, RefreshCw, AlertCircle } from 'lucide-react';
import { useRBAC } from '../../../../api/rbac/useRBAC';
import { AccountForm } from '../AccountForm';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { createPortal } from 'react-dom';

interface AccountSelectorProps {
  value?: string;  // Account code
  onChange: (account: Account | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  scope?: 'valid' | 'all';
  accounts?: Account[];
  allowHeaders?: boolean; // Whether header accounts can be selected
}

export const AccountSelector = forwardRef<HTMLInputElement, AccountSelectorProps>(({
  value,
  onChange,
  placeholder = 'Account code...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur,
  scope = 'valid',
  accounts: providedAccounts,
  allowHeaders = false
}, ref) => {
  const { t } = useTranslation('accounting');
  const { accounts: contextAccounts, validAccounts, isLoading, refreshAccounts, getAccountByCode, getAccountById, createAccount } = useAccounts();
  const { hasPermission } = useRBAC();
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPostingWarning, setShowPostingWarning] = useState(false);
  const [warningParentName, setWarningParentName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const selectableAccounts = providedAccounts || (scope === 'all' ? contextAccounts : validAccounts);

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Sync input value with external value
  useEffect(() => {
    if (value) {
      const account = getAccountByCode(value) || getAccountById(value);
      if (account) {
        const displayCode = account.code || '...';
        const displayName = account.name || 'Unnamed Account';
        setInputValue(`${displayCode} - ${displayName}`);
      } else {
        setInputValue(value);
      }
    } else {
      setInputValue('');
    }
  }, [value, getAccountByCode, getAccountById]);

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
    const codeMatch = selectableAccounts.find((a: Account) => a.code.toLowerCase() === search);
    if (codeMatch) return codeMatch;
    
    // Try exact name match
    const nameMatch = selectableAccounts.find((a: Account) => a.name.toLowerCase() === search);
    if (nameMatch) return nameMatch;
    
    return null;
  };

  // Find closest matches for modal
  const getFilteredAccounts = (searchText: string): Account[] => {
    const search = searchText.trim().toLowerCase();
    if (!search) return selectableAccounts.slice(0, 20); // Show first 20 if no search
    
    return selectableAccounts
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
      setHighlightedIndex(0);
      setShowModal(true);
    }

    // Call external blur
    if (externalBlur) {
      externalBlur();
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

  const handleCreateNewAccount = () => {
    // Check if we have a current selection to propose as parent
    if (value) {
       // Search for the account object in the entire list to be sure
       const currentAccount = contextAccounts.find(a => a.code === value || a.id === value);
       if (currentAccount) {
          if (currentAccount.accountRole === 'POSTING') {
             // Block creation as child of posting account
             setWarningParentName(currentAccount.name);
             setShowModal(false);
             setShowPostingWarning(true);
             return;
          }
       }
    }
    
    setShowModal(false);
    setShowCreateModal(true);
  };

  const handleRefreshAccounts = async () => {
    if (disabled || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await refreshAccounts();
    } catch (err) {
      console.error('Failed to refresh accounts for selector', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredAccounts = getFilteredAccounts(modalSearch);
  const canCreate = hasPermission('accounting.chartOfAccounts.create');

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
          placeholder={placeholder || t('accountSelector.placeholder', 'Account code...')}
          disabled={disabled}
          className={`w-full text-xs transition-colors duration-200 ${noBorder ? 'p-1 border-none bg-transparent' : 'p-2 pr-16 border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)]'} 
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {!disabled && (
          <div className="absolute right-1 flex items-center gap-1">
            {!noBorder && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleRefreshAccounts}
                disabled={isRefreshing}
                title={t('accountSelector.refresh', 'Refresh accounts')}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
            {inputValue && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {canCreate && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCreateNewAccount}
                title={t('accountSelector.createNewTooltip', 'Create as child of current account')}
                className="rounded p-1 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
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
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && filteredAccounts.length === 0 && canCreate) {
                        handleCreateNewAccount();
                      } else {
                        handleModalKeyDown(e);
                      }
                    }}
                    placeholder={t('accountSelector.searchPlaceholder', 'Search accounts...')}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleRefreshAccounts}
                    disabled={isRefreshing}
                    title={t('accountSelector.refresh', 'Refresh accounts')}
                    className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
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
                    {t('accountSelector.loading', 'Loading accounts...')}
                  </div>
                ) : filteredAccounts.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300">
                       <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {t('accountSelector.noResults', 'No accounts found')}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">
                        {t('accountSelector.noResultsDetail', 'We couldn\'t find any account matching your search.')}
                      </p>
                    </div>
                    {canCreate && (
                      <button
                        onClick={handleCreateNewAccount}
                        className="mt-2 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        {t('accountSelector.createNew', 'Create New Account')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        onClick={() => {
                          if (account.accountRole === 'HEADER' && !allowHeaders) return;
                          handleSelectAccount(account);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-4 py-3 flex justify-between items-center text-sm rounded-md transition-colors
                          ${account.accountRole === 'HEADER' && !allowHeaders 
                            ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                            : 'cursor-pointer'}
                          ${index === highlightedIndex && !(account.accountRole === 'HEADER' && !allowHeaders) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-[var(--color-bg-tertiary)]'}
                          ${account.code === value ? 'border-l-2 border-primary-500 bg-primary-50/50 dark:bg-primary-900/30' : ''}`}
                      >
                          <span className={`font-mono text-xs font-bold ${account.accountRole === 'HEADER' ? 'text-indigo-600' : 'text-[var(--color-text-primary)]'}`}>
                            {account.code || (account.name ? 'No Code' : `ID: ${account.id.slice(0, 8)}`)}
                          </span>
                          <div className="flex items-center gap-2">
                             <span className={`text-[13px] tracking-tight truncate ${account.accountRole === 'HEADER' ? 'font-bold' : 'font-medium text-[var(--color-text-secondary)]'}`}>
                               {account.name || 'Unnamed Account'}
                             </span>
                             <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1 py-0.5 rounded uppercase font-extrabold tracking-tighter">
                               {account.classification || account.type}
                             </span>
                             {account.accountRole === 'HEADER' && (
                               <span className="text-[9px] bg-indigo-50 text-indigo-500 px-1 py-0.5 rounded uppercase font-extrabold">HEADER</span>
                             )}
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

      {/* Create Account Modal Overlay - Portal to body to ensure it's on top of windows but below ConfirmDialog */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4">
           <AccountForm
             mode="create"
             initialValues={{
                userCode: modalSearch.match(/^\d+$/) ? modalSearch : '',
                name: !modalSearch.match(/^\d+$/) ? modalSearch : '',
                accountRole: 'POSTING',
                status: 'ACTIVE',
                parentId: (value && (getAccountByCode(value) || getAccountById(value))?.accountRole === 'HEADER') 
                    ? (getAccountByCode(value) || getAccountById(value))?.id 
                    : undefined
             } as any}
             accounts={contextAccounts as any[]}
             onSubmit={async (data) => {
                setIsCreating(true);
                try {
                  const newAcc = await createAccount(data);
                  handleSelectAccount(newAcc);
                  setShowCreateModal(false);
                } catch (e) {
                   // Error handled in form or context
                } finally {
                  setIsCreating(false);
                }
             }}
             onCancel={() => setShowCreateModal(false)}
           />
        </div>
      , document.body)}

      {/* Posting Account Safety Overlay */}
      <ConfirmDialog
        isOpen={showPostingWarning}
        title="Invalid Parent Selection"
        tone="warning"
        icon={<AlertCircle size={24} />}
        message={
           <div className="space-y-4">
              <p>You are attempting to create a new account as a child of <strong className="text-slate-900 italic">"{warningParentName}"</strong>.</p>
              <div className="bg-amber-100/50 p-4 rounded-xl border border-amber-200">
                 <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Accounting Rule Violation</h4>
                 <p className="text-amber-700 text-xs leading-relaxed">
                    Account <strong>"{warningParentName}"</strong> is a <span className="underline decoration-2">Posting Account</span> (Transaction level). 
                    In a professional Chart of Accounts, only <strong>Header Accounts</strong> can have children.
                 </p>
              </div>
              <p className="text-slate-500 italic text-[11px]">
                 <strong>Instruction:</strong> To organize your accounts correctly, please select a Header Account (Summary Account) before clicking the creation button, or create a root-level account first.
              </p>
           </div>
        }
        confirmLabel="I Understand"
        onConfirm={() => setShowPostingWarning(false)}
        onCancel={() => setShowPostingWarning(false)}
      />
    </>
  );
});

AccountSelector.displayName = 'AccountSelector';

export default AccountSelector;
