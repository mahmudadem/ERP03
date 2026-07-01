import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, RefreshCw, User, Mail, Phone, CreditCard } from 'lucide-react';
import { sharedApi, PartyDTO, PartyRole } from '../../../api/sharedApi';
import { useCompanyCurrencies } from '../../../hooks/useCompanyCurrencies';
import { useSelectorModalFocus } from './useSelectorModalFocus';
import PartyMasterCard from '../../../modules/shared/components/PartyMasterCard';

interface PartySelectorProps {
  value?: string;
  onChange: (party: PartyDTO | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  role?: PartyRole;
}

interface CreatePartyFormState {
  code: string;
  displayName: string;
  role: 'CUSTOMER' | 'VENDOR' | 'BOTH';
  defaultCurrency: string;
  email: string;
  phone: string;
}

const buildCreateSeed = (rawSearch: string, defaultCurrency: string): CreatePartyFormState => {
  const trimmed = rawSearch.trim();
  const looksLikeCode = !!trimmed && !/\s/.test(trimmed) && trimmed.length < 15;

  return {
    code: looksLikeCode ? trimmed.toUpperCase() : '',
    displayName: trimmed,
    role: 'CUSTOMER',
    defaultCurrency,
    email: '',
    phone: '',
  };
};

export const PartySelector = forwardRef<HTMLInputElement, PartySelectorProps>(({
  value,
  onChange,
  placeholder = 'Select customer or vendor...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur,
  role,
}, ref) => {
  const { t } = useTranslation('shared');
  const actualPlaceholder = placeholder || (
    role === 'CUSTOMER'
      ? t('partySelector.customerPlaceholder')
      : role === 'VENDOR'
      ? t('partySelector.vendorPlaceholder')
      : t('partySelector.placeholder')
  );
  const { data: currencies = [] } = useCompanyCurrencies();
  const currencyOptions = currencies.map((currency) => ({
    code: currency.code,
    label: `${currency.code} — ${currency.name}`,
  }));

  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [allParties, setAllParties] = useState<PartyDTO[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<PartyDTO[]>([]);
  const [selectedParty, setSelectedParty] = useState<PartyDTO | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreatePartyFormState>(() =>
    buildCreateSeed('', 'USD')
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    showModal,
    () => setShowModal(false),
    inputRef
  );
  const { modalRef: createModalRef, handleKeyDown: handleCreateFocusTrapKeyDown } = useSelectorModalFocus(
    showCreateModal,
    () => setShowCreateModal(false),
    inputRef
  );

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  // Sync value prop with local state
  useEffect(() => {
    // Defensive check: if value is an object, try to extract ID
    const normalizedValue = typeof value === 'object' && value !== null 
      ? ((value as any).id || (value as any).code || '') 
      : (value || '');

    if (normalizedValue) {
      if (selectedParty?.id === normalizedValue || selectedParty?.code === normalizedValue) return;

      const fetchParty = async () => {
        try {
          const party = await sharedApi.getParty(normalizedValue);
          if (party) {
            setSelectedParty(party);
            setInputValue(`${party.code} - ${party.displayName}`);
          }
        } catch (error) {
          // If ID lookup fails, try searching
          try {
            const results = await sharedApi.listParties({ active: true });
            const found = results.find(p => p.id === normalizedValue || p.code === normalizedValue || p.displayName === normalizedValue);
            if (found) {
              setSelectedParty(found);
              setInputValue(`${found.code} - ${found.displayName}`);
            } else {
              setInputValue(normalizedValue);
            }
          } catch (e) {
            setInputValue(normalizedValue);
          }
        }
      };

      fetchParty();
    } else {
      setSelectedParty(null);
      setInputValue('');
    }
  }, [value, selectedParty?.id, selectedParty?.code]);

  const loadAllParties = async (force = false) => {
    if (hasLoadedOnce && !force) return;
    setIsRefreshing(true);
    try {
      const results = await sharedApi.listParties({ active: true, ...(role ? { role } : {}) });
      setAllParties(results);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Failed to load parties for cache', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setHasLoadedOnce(false);
    loadAllParties();
  }, [role]);

  useEffect(() => {
    if (showModal) {
      performSearch(modalSearch);
    }
  }, [modalSearch, showModal]);

  // Set default currency when create modal opens
  useEffect(() => {
    if (!showCreateModal || createForm.defaultCurrency || currencyOptions.length === 0) return;

    setCreateForm((current) => ({
      ...current,
      defaultCurrency: currencyOptions[0]?.code || 'USD',
    }));
  }, [currencyOptions, showCreateModal, createForm.defaultCurrency]);

  const performSearch = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) {
      setSearchResults([]);
      return;
    }

    // Try local filter first
    const localMatches = allParties.filter(p => {
      const compound = `${p.code} - ${p.displayName}`.toLowerCase();
      return (
        compound.includes(lowerQuery) ||
        p.email?.toLowerCase().includes(lowerQuery)
      );
    });

    if (localMatches.length > 0) {
      setSearchResults(localMatches.slice(0, 20));
      return;
    }

    setIsLoading(true);
    try {
      // If we need a deeper search, we could call an API here, 
      // but for now, we just use the cache we already have or call list again if needed.
      // But since we have allParties, we stick to it unless forced.
      setSearchResults(localMatches.slice(0, 20));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    // 1. Check if it matches current selection display
    if (selectedParty && inputValue === `${selectedParty.code} - ${selectedParty.displayName}`) {
      if (externalBlur) externalBlur();
      return;
    }

    const query = inputValue.toLowerCase().trim();

    // 2. Try to find exact match or unique match in local cache first
    const localMatches = allParties.filter(p => 
      p.code.toLowerCase() === query || 
      p.displayName.toLowerCase() === query ||
      `${p.code} - ${p.displayName}`.toLowerCase() === query
    );

    if (localMatches.length === 1) {
      handleSelect(localMatches[0]);
      if (externalBlur) externalBlur();
      return;
    }

    if (localMatches.length > 1) {
       // More than one result - open modal to resolve
       setSearchResults(localMatches.slice(0, 20));
       setHighlightedIndex(0);
       setModalSearch(inputValue.trim());
       setShowModal(true);
       if (externalBlur) externalBlur();
       return;
    }

    const fuzzyMatches = allParties.filter(p => {
      const compound = `${p.code} - ${p.displayName}`.toLowerCase();
      return compound.includes(query) || p.email?.toLowerCase().includes(query);
    });

    if (fuzzyMatches.length === 1) {
      handleSelect(fuzzyMatches[0]);
      if (externalBlur) externalBlur();
      return;
    }

    // If typing manually, open modal if not matched
    setHighlightedIndex(0);
    setModalSearch(inputValue);
    setShowModal(true);

    if (externalBlur) externalBlur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        handleInputBlur();
      }
      if (externalKeyDown) externalKeyDown(e);
      return;
    }
  };

  const handleSelect = (party: PartyDTO) => {
    setSelectedParty(party);
    setInputValue(`${party.code} - ${party.displayName}`);
    onChange(party);
    setShowModal(false);
    setShowCreateModal(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    setSelectedParty(null);
    inputRef.current?.focus();
  };

  const handleOpenCreateModal = () => {
    setShowModal(false);
    setShowCreateModal(true);
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.code.trim() || !createForm.displayName.trim() || !createForm.defaultCurrency.trim()) {
      setCreateError(t('partySelector.createRequired'));
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const roles: PartyRole[] = role
        ? [role]
        : createForm.role === 'BOTH'
        ? ['CUSTOMER', 'VENDOR'] 
        : [createForm.role as PartyRole];

      const created = await sharedApi.createParty({
        code: createForm.code.trim().toUpperCase(),
        displayName: createForm.displayName.trim(),
        legalName: createForm.displayName.trim(),
        roles,
        accountStrategy: 'AUTO_CREATE',
        defaultCurrency: createForm.defaultCurrency.trim().toUpperCase(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        active: true,
      });

      handleSelect(created);
    } catch (error: any) {
      setCreateError(error?.response?.data?.message || error?.message || t('partySelector.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <div className="absolute left-2.5 text-slate-400">
          <User size={14} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={(e) => { try { e.currentTarget.select(); } catch { /* noop */ } }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={actualPlaceholder}
          disabled={disabled}
          className={`w-full transition-all duration-200 outline-none
            ${noBorder
              ? 'border-0 bg-transparent p-1 pl-8 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20'
              : 'text-xs rounded-lg border border-slate-200 bg-white p-2 pl-8 pr-10 hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900'}
            ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
        />
        {!disabled && (
          <div className="absolute right-2 flex items-center gap-1">
            {inputValue && (
              <button 
                type="button" 
                onClick={handleClear} 
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              ref={modalRef}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.target !== modalInputRef.current) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(searchResults.length - 1, 0)));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' && searchResults[highlightedIndex]) {
                    e.preventDefault();
                    handleSelect(searchResults[highlightedIndex]);
                    return;
                  }
                }
                handleFocusTrapKeyDown(e);
              }}
              className="pointer-events-auto flex max-h-[500px] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50">
                <Search size={18} className="text-slate-400" />
                <input
                  ref={modalInputRef}
                  autoFocus
                  className="flex-1 border-none bg-transparent text-sm outline-none font-medium"
                  placeholder={t('partySelector.searchPlaceholder')}
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(searchResults.length - 1, 0)));
                    if (e.key === 'ArrowUp') setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    if (e.key === 'Enter' && searchResults[highlightedIndex]) handleSelect(searchResults[highlightedIndex]);
                    if (e.key === 'Enter' && searchResults.length === 0 && modalSearch.trim()) handleOpenCreateModal();
                    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) e.stopPropagation();
                  }}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => loadAllParties(true)}
                  disabled={isRefreshing}
                  title={t('partySelector.refresh', 'Refresh parties')}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  title={t('partySelector.create', 'Create new party')}
                  className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {searchResults.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center p-10 text-center">
                    <User size={40} className="mb-3 text-slate-200" />
                    <p className="text-sm font-medium text-slate-500">{t('partySelector.noResults', { query: modalSearch })}</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      <Plus size={16} /> {t('partySelector.createNewParty')}
                    </button>
                  </div>
                )}

                {searchResults.map((party, i) => (
                  <div
                    key={party.id}
                    onClick={() => handleSelect(party)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`flex cursor-pointer items-start justify-between rounded-xl px-4 py-3 transition-colors
                      ${i === highlightedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{party.displayName}</span>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase font-bold text-slate-500 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          {party.code}
                        </span>
                        {party.email && (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Mail size={10} /> {party.email}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex gap-1">
                        {party.roles.map(role => (
                          <span key={role} className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider
                            ${role === 'CUSTOMER' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {role === 'CUSTOMER' ? t('partySelector.roleCustomer') : t('partySelector.roleVendor')}
                          </span>
                        ))}
                      </div>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                        <CreditCard size={10} /> {party.defaultCurrency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {showCreateModal && (
        <>
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[4px]" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              ref={createModalRef}
              tabIndex={-1}
              onKeyDown={handleCreateFocusTrapKeyDown}
              className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-950"
            >
              <PartyMasterCard
                partyId="new"
                isWindow
                role={role || 'CUSTOMER'}
                onClose={() => setShowCreateModal(false)}
                onSaved={(party) => {
                  handleSelect(party);
                  void loadAllParties(true);
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
});

PartySelector.displayName = 'PartySelector';

