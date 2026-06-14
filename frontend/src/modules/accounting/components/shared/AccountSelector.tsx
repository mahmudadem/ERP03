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
import { Search, X, Plus, RefreshCw, AlertCircle, Filter, Lock } from 'lucide-react';
import { useRBAC } from '../../../../api/rbac/useRBAC';
import { AccountForm } from '../AccountForm';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Spinner } from '../../../../components/ui/Spinner';
import { createPortal } from 'react-dom';
import { useSelectorModalFocus } from '../../../../components/shared/selectors/useSelectorModalFocus';

export type AccountClassification = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

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
  /**
   * Hard contextual filter: only accounts with these classifications are shown.
   * Cannot be bypassed by the user — use when the field's semantics demand it
   * (e.g. "Default Revenue Account" must be REVENUE). Pass a human label so the
   * filter status bar reads naturally ("Income accounts only").
   */
  allowedClassifications?: AccountClassification[];
  contextLabel?: string; // e.g. "Income", "Asset", "Cash/Bank"
  /** If true, the classification filter tag cannot be toggled off by the user. */
  enforceClassification?: boolean;
  /** If true, the scope (POSTING / All) filter tag cannot be toggled off by the user. */
  enforceScope?: boolean;
}

const classificationDisplay = (c: AccountClassification): string => {
  switch (c) {
    case 'ASSET': return 'Asset';
    case 'LIABILITY': return 'Liability';
    case 'EQUITY': return 'Equity';
    case 'REVENUE': return 'Income';
    case 'EXPENSE': return 'Expense';
  }
};

const matchesClassification = (account: Account, allowed: AccountClassification[]): boolean => {
  const c = String(account.classification || account.type || '').toUpperCase();
  return allowed.includes(c as AccountClassification);
};

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
  allowHeaders = false,
  allowedClassifications,
  contextLabel,
  enforceClassification = false,
  enforceScope = false
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
  const [scopeOverride, setScopeOverride] = useState<'valid' | 'all' | null>(null);
  const [classificationFilterDisabled, setClassificationFilterDisabled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    showModal,
    () => setShowModal(false),
    inputRef
  );
  const effectiveScope = scopeOverride ?? scope;
  const baseAccounts = providedAccounts || (effectiveScope === 'all' ? contextAccounts : validAccounts);
  const classificationFilterActive = !!(allowedClassifications && allowedClassifications.length > 0) && !classificationFilterDisabled;
  const selectableAccounts = classificationFilterActive
    ? baseAccounts.filter((a) => matchesClassification(a, allowedClassifications!))
    : baseAccounts;

  const classificationFilterLabel = allowedClassifications && allowedClassifications.length > 0
    ? (contextLabel || allowedClassifications.map(classificationDisplay).join(' / '))
    : null;

  const filterLabel = providedAccounts
    ? `Custom list (${providedAccounts.length})`
    : effectiveScope === 'all'
      ? `All accounts (${contextAccounts.length})`
      : `Posting · Active · No children (${validAccounts.length} of ${contextAccounts.length})`;

  // Warn when current value's classification doesn't match the contextual filter
  const currentAccount = value ? (getAccountByCode(value) || getAccountById(value)) : undefined;
  const classificationMismatch = !!(
    allowedClassifications &&
    allowedClassifications.length > 0 &&
    currentAccount &&
    !matchesClassification(currentAccount, allowedClassifications)
  );

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
    
    // Try compound string match
    const compoundMatch = selectableAccounts.find((a: Account) => `${a.code} - ${a.name}`.toLowerCase() === search);
    if (compoundMatch) return compoundMatch;

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
      .filter((a: Account) => {
        const compound = `${a.code} - ${a.name}`.toLowerCase();
        return compound.includes(search);
      })
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

    // Try to find exact match or unique match
    const filtered = getFilteredAccounts(inputValue);
    
    if (filtered.length === 1) {
      handleSelectAccount(filtered[0]);
    } else {
      setHighlightedIndex(0);
      setModalSearch(inputValue.trim());
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
      default:
        handleFocusTrapKeyDown(e);
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
          onFocus={(e) => { try { e.currentTarget.select(); } catch { /* noop */ } }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('accountSelector.placeholder', 'Account code...')}
          disabled={disabled}
          className={`w-full transition-colors duration-200 ${noBorder ? 'border-0 bg-transparent p-1 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20' : `text-xs p-2 pr-16 border rounded bg-[var(--color-bg-primary)] ${classificationMismatch ? 'border-amber-400 ring-1 ring-amber-200' : 'border-[var(--color-border)]'}`}
            focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]
            ${disabled ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] cursor-not-allowed' : ''}`}
        />
        {!disabled && (
          <div className="absolute right-1 flex items-center gap-1">
            {classificationMismatch && (
              <span
                title={`This account's classification (${currentAccount?.classification || currentAccount?.type}) doesn't match the expected type for this field (${classificationFilterLabel}). Pick a ${classificationFilterLabel} account to fix your accounting reports.`}
                className="rounded p-0.5 text-amber-600"
              >
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
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
          </div>
        )}
      </div>
      {classificationMismatch && (
        <p className="mt-1 text-[10px] text-amber-700 italic">
          ⚠ Wrong account type — expected {classificationFilterLabel}, got {currentAccount?.classification || currentAccount?.type}. This will distort your financial reports.
        </p>
      )}

      {/* Search Modal */}
      {showModal && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40" 
            onClick={() => setShowModal(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div
              ref={modalRef}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.target === modalInputRef.current) return;
                handleModalKeyDown(event);
              }}
              className="bg-[var(--color-bg-primary)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-[var(--color-border)] w-full max-w-lg max-h-[500px] pointer-events-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
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
                  {canCreate && (
                    <button
                      type="button"
                      onClick={handleCreateNewAccount}
                      title={t('accountSelector.createNew', 'Create New Account')}
                      className="p-1.5 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter status bar — compact, clickable tags */}
              <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] flex items-center gap-1.5 text-[10px]">
                <Filter className="w-3 h-3 text-[var(--color-text-muted)]" />
                {classificationFilterLabel && (() => {
                  const isLocked = enforceClassification;
                  const active = classificationFilterActive;
                  const why = `Limits the list to ${classificationFilterLabel} accounts — the only category that makes accounting sense for this field. Picking a different type (e.g. an Expense account here) will distort your P&L and balance sheet because debits and credits land on the wrong financial statement line.`;
                  const tooltip = isLocked
                    ? `LOCKED BY CONTEXT — this field strictly requires ${classificationFilterLabel} accounts. ${why}`
                    : active
                      ? `ACTIVE — click to disable.\n\nWhy this filter exists: ${why}`
                      : `DISABLED — click to re-enable.\n\nWhy this filter exists: ${why}`;
                  return (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setClassificationFilterDisabled((d) => !d)}
                      title={tooltip}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold uppercase tracking-wide border transition
                        ${active
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200'}
                        ${isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                    >
                      {isLocked && <Lock className="w-2.5 h-2.5" />}
                      {classificationFilterLabel}
                    </button>
                  );
                })()}
                {!providedAccounts && (() => {
                  const isLocked = enforceScope;
                  const active = effectiveScope === 'valid';
                  const why = `Hides header (summary) accounts, inactive accounts, and any account that has children. Only leaf POSTING accounts can receive journal entries — picking a header would break double-entry posting and corrupt your trial balance.`;
                  const tooltip = isLocked
                    ? `LOCKED BY CONTEXT — only postable accounts are allowed here. ${why}`
                    : active
                      ? `ACTIVE — click to show all accounts (headers, inactive, parents).\n\nWhy this filter exists: ${why}`
                      : `DISABLED — click to limit to postable accounts.\n\nWhy this filter exists: ${why}`;
                  return (
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => !isLocked && setScopeOverride(effectiveScope === 'all' ? 'valid' : 'all')}
                      title={tooltip}
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold uppercase tracking-wide border transition
                        ${active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through hover:bg-slate-200'}
                        ${isLocked ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
                    >
                      {isLocked && <Lock className="w-2.5 h-2.5" />}
                      POSTING
                    </button>
                  );
                })()}
                <span className="ml-auto text-[10px] text-[var(--color-text-muted)] font-mono">{selectableAccounts.length}</span>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto custom-scroll p-1">
                {isLoading ? (
                  <div className="p-8 text-center text-[var(--color-text-muted)] text-sm flex flex-col items-center gap-3">
                    <Spinner size="md" variant="primary" />
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
                        {classificationFilterActive
                          ? `No ${classificationFilterLabel} account matches. Create one with the + button, or click "Disable type filter" above to see all account types.`
                          : effectiveScope === 'valid' && !providedAccounts
                            ? 'The active filter hides header accounts, inactive accounts, and accounts with children. Try "Show all accounts" above.'
                            : t('accountSelector.noResultsDetail', 'We couldn\'t find any account matching your search.')}
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
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredAccounts.map((account, index) => (
                      <div
                        key={account.id}
                        onClick={() => {
                          if (account.accountRole === 'HEADER' && !allowHeaders) return;
                          handleSelectAccount(account);
                        }}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-4 py-3 flex justify-between items-center text-sm transition-all duration-150
                          ${account.accountRole === 'HEADER' && !allowHeaders 
                            ? 'opacity-40 cursor-not-allowed grayscale' 
                            : 'cursor-pointer'}
                          ${index === highlightedIndex && !(account.accountRole === 'HEADER' && !allowHeaders) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}
                          ${account.code === value ? 'border-l-4 border-primary-500 bg-primary-50/30' : ''}`}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`font-mono text-[11px] font-black leading-none mb-1.5 ${account.accountRole === 'HEADER' ? 'text-indigo-600' : 'text-primary-600'}`}>
                            {account.code || (account.name ? 'NO-CODE' : `ID: ${account.id.slice(0, 8)}`)}
                          </span>
                          <span className={`text-[13px] tracking-tight truncate ${account.accountRole === 'HEADER' ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
                            {account.name || 'Unnamed Account'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0 ml-4">
                          {account.currency && (
                             <span className="text-[9px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-800 uppercase font-black tracking-tighter">
                               {account.currency}
                             </span>
                          )}
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-tighter border border-slate-200 dark:border-slate-700">
                            {account.classification || account.type}
                          </span>
                          {account.accountRole === 'HEADER' && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase font-black border border-indigo-100">HEADER</span>
                          )}
                        </div>

                        {account.code === value && (
                           <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] ml-3" />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
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

