import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, RefreshCw, Box } from 'lucide-react';
import { inventoryApi, InventoryItemDTO, InventoryUomDTO } from '../../../api/inventoryApi';
import { useCompanyCurrencies } from '../../../hooks/useCompanyCurrencies';
import { useSelectorModalFocus } from './useSelectorModalFocus';
import ItemMasterCard from '../../../modules/inventory/components/ItemMasterCard';

interface ItemSelectorProps {
  value?: string;
  onChange: (item: InventoryItemDTO | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  trackInventoryOnly?: boolean;
}

interface CreateItemFormState {
  code: string;
  name: string;
  type: InventoryItemDTO['type'];
  baseUomId?: string;
  baseUom: string;
  costCurrency: string;
  trackInventory: boolean;
}

const buildCreateSeed = (rawSearch: string, costCurrency: string): CreateItemFormState => {
  const trimmed = rawSearch.trim();
  const looksLikeCode = !!trimmed && !/\s/.test(trimmed);

  return {
    code: looksLikeCode ? trimmed.toUpperCase() : '',
    name: trimmed,
    type: 'PRODUCT',
    baseUom: 'PCS',
    costCurrency,
    trackInventory: true,
  };
};

export const ItemSelector = forwardRef<HTMLInputElement, ItemSelectorProps>(({
  value,
  onChange,
  placeholder = 'Select item...',
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur,
  trackInventoryOnly = false,
}, ref) => {
  const { t } = useTranslation('inventory');
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
  const [searchResults, setSearchResults] = useState<InventoryItemDTO[]>([]);
  const [selectedItem, setSelectedItem] = useState<InventoryItemDTO | null>(null);
  const [uoms, setUoms] = useState<InventoryUomDTO[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreateItemFormState>(() =>
    buildCreateSeed('', 'USD')
  );
  const [allItems, setAllItems] = useState<InventoryItemDTO[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
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

  useEffect(() => {
    // Defensive check: if value is an object, try to extract ID
    const normalizedValue = typeof value === 'object' && value !== null 
      ? ((value as any).id || (value as any).code || '') 
      : (value || '');

    if (normalizedValue) {
      if (selectedItem?.id === normalizedValue || selectedItem?.code === normalizedValue) return;

      const fetchItem = async () => {
        try {
          const item = await inventoryApi.getItem(normalizedValue);
          if (item) {
            setSelectedItem(item);
            setInputValue(`${item.code} - ${item.name}`);
            return;
          }

          const searchResult = await inventoryApi.searchItems(
            normalizedValue,
            1,
            undefined,
            trackInventoryOnly ? { trackInventory: true } : undefined
          );

          if (searchResult.length > 0) {
            setSelectedItem(searchResult[0]);
            setInputValue(`${searchResult[0].code} - ${searchResult[0].name}`);
          } else {
            setInputValue(normalizedValue);
          }
        } catch (error) {
          setInputValue(normalizedValue);
        }
      };

      fetchItem();
    } else {
      setSelectedItem(null);
      setInputValue('');
    }
  }, [selectedItem?.code, selectedItem?.id, trackInventoryOnly, value]);

  const loadAllItems = async (force = false) => {
    if (hasLoadedOnce && !force) return;
    setIsRefreshing(true);
    try {
      const results = await inventoryApi.listItems({ 
        active: true, 
        limit: 1000,
        ...(trackInventoryOnly ? { trackInventory: true } : {})
      });
      setAllItems(results);
      setHasLoadedOnce(true);
    } catch (error) {
      console.error('Failed to load items for cache', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllItems();
  }, [trackInventoryOnly]);

  useEffect(() => {
    if (!showModal) return;

    const lowerQuery = modalSearch.toLowerCase().trim();

    // 1. Immediate local search from cache (up to 1000 items)
    const localMatches = allItems.filter(item => {
      const compound = `${item.code} - ${item.name}`.toLowerCase();
      return (
        compound.includes(lowerQuery) ||
        (item.barcode && item.barcode.toLowerCase().includes(lowerQuery))
      );
    });

    // Update results immediately for local matches
    setSearchResults(localMatches.slice(0, 20));
    setIsLoading(false);
  }, [modalSearch, showModal, allItems]);

  useEffect(() => {
    if (!showCreateModal || createForm.costCurrency) return;

    setCreateForm((current) => ({
      ...current,
      costCurrency: currencyOptions[0]?.code || 'USD',
    }));
  }, [createForm.costCurrency, currencyOptions, showCreateModal]);

  useEffect(() => {
    let active = true;

    const loadUoms = async () => {
      try {
        const result = await inventoryApi.listUoms({ active: true, limit: 200 });
        if (!active) return;
        const nextUoms = Array.isArray(result) ? result : [];
        setUoms(nextUoms);
        setCreateForm((current) => {
          if (current.baseUomId || !nextUoms.length) return current;
          const selected = nextUoms.find((uom) => uom.code === current.baseUom) || nextUoms[0];
          return {
            ...current,
            baseUomId: selected?.id,
            baseUom: selected?.code || current.baseUom,
          };
        });
      } catch (error) {
        console.error('Failed to load UOMs for item selector', error);
      }
    };

    void loadUoms();

    return () => {
      active = false;
    };
  }, []);

  const performSearch = async (query: string) => {
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return;

    setIsSearchingServer(true);
    try {
      const results = await inventoryApi.searchItems(
        query,
        20,
        undefined,
        trackInventoryOnly ? { trackInventory: true } : undefined
      );
      
      setSearchResults(prev => {
        // Merge with local results, avoiding duplicates
        const merged = [...prev];
        results.forEach(item => {
          if (!merged.find(m => m.id === item.id)) {
            merged.push(item);
          }
        });
        return merged.slice(0, 20);
      });
    } catch (error) {
      console.error('Item search failed', error);
    } finally {
      setIsSearchingServer(false);
    }
  };

  const handleInputBlur = async () => {
    const trimmedQuery = inputValue.trim();
    if (!trimmedQuery) {
      if (value) onChange(null);
      return;
    }

    if (selectedItem && trimmedQuery === `${selectedItem.code} - ${selectedItem.name}`) {
      return;
    }

    // 1. Check local cache (exact matches first, then partial)
    const lowerQuery = trimmedQuery.toLowerCase();

    // Find all potential matches in the 1000-item cache
    const matches = allItems.filter(item => {
      const code = item.code.toLowerCase();
      const name = item.name.toLowerCase();
      const barcode = item.barcode?.toLowerCase();
      const compound = `${item.code} - ${item.name}`.toLowerCase();

      return (
        code === lowerQuery ||
        name === lowerQuery ||
        compound === lowerQuery ||
        barcode === lowerQuery ||
        code.includes(lowerQuery) ||
        name.includes(lowerQuery) ||
        (barcode && barcode.includes(lowerQuery))
      );
    });

    // Strategy A: Only one match found in cache -> Select it immediately
    if (matches.length === 1) {
      handleSelect(matches[0]);
      if (externalBlur) externalBlur();
      return;
    }

    // Strategy B: More than one match or zero matches -> Show modal instantly
    // We don't wait for the server here to keep it snappy.
    setSearchResults(matches.slice(0, 20));
    setHighlightedIndex(0);
    setModalSearch(trimmedQuery);
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

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && externalKeyDown) {
      externalKeyDown(e);
    }
  };

  const handleSelect = (item: InventoryItemDTO) => {
    setSelectedItem(item);
    setInputValue(`${item.code} - ${item.name}`);
    onChange(item);
    setShowModal(false);
    setShowCreateModal(false);
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    setSelectedItem(null);
    inputRef.current?.focus();
  };

  const handleOpenCreateModal = () => {
    setShowModal(false);
    setShowCreateModal(true);
  };

  const getCreateErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error && 'response' in error) {
      const response = (error as any).response;
      return response?.data?.message || response?.data?.error || 'Failed to create item.';
    }

    if (error instanceof Error) return error.message;
    return 'Failed to create item.';
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.code.trim() || !createForm.name.trim() || !createForm.baseUom.trim() || !createForm.costCurrency.trim()) {
      setCreateError('Code, name, base UoM, and cost currency are required.');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const created = await inventoryApi.createItem({
        code: createForm.code.trim(),
        name: createForm.name.trim(),
        type: createForm.type,
        baseUomId: createForm.baseUomId,
        baseUom: createForm.baseUom.trim(),
        costCurrency: createForm.costCurrency.trim().toUpperCase(),
        trackInventory: trackInventoryOnly ? true : createForm.type === 'SERVICE' ? false : createForm.trackInventory,
      });

      handleSelect(created);
    } catch (error) {
      setCreateError(getCreateErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <div className="absolute left-2.5 text-slate-400">
          <Box size={14} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={(e) => { try { e.currentTarget.select(); } catch { /* noop */ } }}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('itemSelector.placeholder', 'Select item...')}
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
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={() => setShowModal(false)} />
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
              className="pointer-events-auto flex max-h-[500px] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                <Search size={18} className="text-slate-400" />
                <input
                  ref={modalInputRef}
                  autoFocus
                  className="flex-1 border-none bg-transparent text-sm outline-none"
                  placeholder="Search items by name, code or barcode..."
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
                  onClick={() => loadAllItems(true)}
                  disabled={isRefreshing}
                  title={t('itemSelector.refresh', 'Refresh items')}
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
                  title={t('itemSelector.create', 'Create new item')}
                  className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                {searchResults.length === 0 && !isSearchingServer && (
                  <div className="flex flex-col items-center p-8 text-center">
                    <Box size={32} className="mb-2 text-slate-200" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">No items found in local cache</p>
                    <p className="mt-1 text-xs text-slate-500">Matching "{modalSearch}"</p>
                    
                    <div className="mt-6 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => performSearch(modalSearch)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Search size={14} /> Search Entire Database
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Plus size={14} /> Create "{modalSearch}"
                      </button>
                    </div>
                  </div>
                )}

                {isSearchingServer && (
                  <div className="flex flex-col items-center p-12 text-center">
                    <RefreshCw size={32} className="mb-3 animate-spin text-indigo-500" />
                    <p className="text-sm font-bold text-slate-700">Searching server...</p>
                    <p className="text-xs text-slate-400">Scanning full item registry</p>
                  </div>
                )}

                {searchResults.map((item, i) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    className={`flex cursor-pointer items-start justify-between rounded-lg px-4 py-3
                      ${i === highlightedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800">
                          {item.code}
                        </span>
                        {item.barcode && <span className="text-[10px] text-slate-400">Scan: {item.barcode}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-500">{item.type}</span>
                      <span className="text-[9px] text-slate-400">Unit: {item.baseUom}</span>
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
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div
              ref={createModalRef}
              tabIndex={-1}
              onKeyDown={handleCreateFocusTrapKeyDown}
              className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-950"
            >
              <ItemMasterCard
                itemId="new"
                isWindow
                onClose={() => setShowCreateModal(false)}
                onSaved={(item) => {
                  handleSelect(item);
                  void loadAllItems(true);
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
});

ItemSelector.displayName = 'ItemSelector';

