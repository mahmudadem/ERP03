import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, RefreshCw, User, Mail, Phone, CreditCard } from 'lucide-react';
import { sharedApi, PartyDTO, PartyRole } from '../../../api/sharedApi';
import { useCompanyCurrencies } from '../../../modules/accounting/hooks/useCompanyCurrencies';

interface PartySelectorProps {
  value?: string;
  onChange: (party: PartyDTO | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
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
}, ref) => {
  const { t } = useTranslation('shared');
  const { data: currencies = [] } = useCompanyCurrencies();
  const currencyOptions = currencies.map((currency) => ({
    code: currency.code,
    label: `${currency.code} — ${currency.name}`,
  }));

  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
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

  // Handle modal search
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
    setIsLoading(true);
    try {
      const results = await sharedApi.listParties({ active: true });
      const lowerQuery = query.toLowerCase().trim();
      
      const filtered = results.filter(p => 
        p.displayName.toLowerCase().includes(lowerQuery) || 
        p.code.toLowerCase().includes(lowerQuery) ||
        p.email?.toLowerCase().includes(lowerQuery)
      ).slice(0, 20);

      setSearchResults(filtered);
    } catch (error) {
      console.error('Party search failed', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    if (selectedParty && inputValue === `${selectedParty.code} - ${selectedParty.displayName}`) {
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
    setCreateError('');
    setCreateForm(buildCreateSeed(modalSearch || inputValue, currencyOptions[0]?.code || 'USD'));
    setShowModal(false);
    setShowCreateModal(true);
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.code.trim() || !createForm.displayName.trim() || !createForm.defaultCurrency.trim()) {
      setCreateError('Code, display name, and currency are required.');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const roles: PartyRole[] = createForm.role === 'BOTH' 
        ? ['CUSTOMER', 'VENDOR'] 
        : [createForm.role as PartyRole];

      const created = await sharedApi.createParty({
        code: createForm.code.trim().toUpperCase(),
        displayName: createForm.displayName.trim(),
        legalName: createForm.displayName.trim(),
        roles,
        defaultCurrency: createForm.defaultCurrency.trim().toUpperCase(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        active: true,
      });

      handleSelect(created);
    } catch (error: any) {
      setCreateError(error?.response?.data?.message || error?.message || 'Failed to create party.');
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
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || 'Select customer or vendor...'}
          disabled={disabled}
          className={`w-full text-xs transition-all duration-200
            ${noBorder ? 'border-none bg-transparent p-1 pl-8' : 'rounded-lg border border-slate-200 bg-white p-2 pl-8 pr-10 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'}
            focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none
            ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
        />
        {!disabled && inputValue && (
          <button type="button" onClick={handleClear} className="absolute right-2 text-slate-400 hover:text-slate-600 p-1">
            <X size={14} />
          </button>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto flex max-h-[500px] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800 bg-slate-50/50">
                <Search size={18} className="text-slate-400" />
                <input
                  ref={modalInputRef}
                  autoFocus
                  className="flex-1 border-none bg-transparent text-sm outline-none font-medium"
                  placeholder="Search by name, code or email..."
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') setHighlightedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
                    if (e.key === 'ArrowUp') setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    if (e.key === 'Enter' && searchResults[highlightedIndex]) handleSelect(searchResults[highlightedIndex]);
                    if (e.key === 'Enter' && searchResults.length === 0 && modalSearch.trim()) handleOpenCreateModal();
                    if (e.key === 'Escape') setShowModal(false);
                  }}
                />
                {isLoading && <RefreshCw size={14} className="animate-spin text-indigo-500" />}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {searchResults.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center p-10 text-center">
                    <User size={40} className="mb-3 text-slate-200" />
                    <p className="text-sm font-medium text-slate-500">No parties found matching "{modalSearch}"</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-colors"
                    >
                      <Plus size={16} /> Create New Party
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
                            {role}
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
          <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-[4px]" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800 bg-slate-50/50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create New Party</h3>
                  <p className="mt-1 text-xs text-slate-500">Add a new customer or vendor quickly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form className="grid gap-5 p-6 md:grid-cols-2" onSubmit={handleCreateParty}>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Code</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={createForm.code}
                    onChange={(e) => setCreateForm((current) => ({ ...current, code: e.target.value.toUpperCase() }))}
                    placeholder="COMP-001"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Display Name</label>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={createForm.displayName}
                    onChange={(e) => setCreateForm((current) => ({ ...current, displayName: e.target.value }))}
                    placeholder="Full Business Name"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Primary Role</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['CUSTOMER', 'VENDOR', 'BOTH'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCreateForm(prev => ({ ...prev, role: r }))}
                        className={`rounded-xl border py-2 text-[10px] font-black uppercase tracking-widest transition-all
                          ${createForm.role === r 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-md' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Default Currency</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    value={createForm.defaultCurrency}
                    onChange={(e) => setCreateForm((current) => ({ ...current, defaultCurrency: e.target.value }))}
                  >
                    {currencyOptions.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Email Address (Optional)</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pl-10 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={createForm.email}
                      onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))}
                      placeholder="info@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500">Phone Number (Optional)</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pl-10 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm((current) => ({ ...current, phone: e.target.value }))}
                      placeholder="+1 234..."
                    />
                  </div>
                </div>

                {createError && (
                  <div className="md:col-span-2 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-bold text-rose-600">
                    <X size={14} /> {createError}
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60 shadow-lg shadow-slate-900/20 transition-all active:scale-95"
                  >
                    {isCreating ? 'Creating...' : 'Create Party'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
});

PartySelector.displayName = 'PartySelector';
