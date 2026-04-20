import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, RefreshCw, Box } from 'lucide-react';
import { inventoryApi, InventoryItemDTO, InventoryUomDTO } from '../../../api/inventoryApi';
import { useCompanyCurrencies } from '../../../modules/accounting/hooks/useCompanyCurrencies';

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
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreateItemFormState>(() =>
    buildCreateSeed('', 'USD')
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (showModal) {
      performSearch(modalSearch);
    }
  }, [modalSearch, showModal]);

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
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await inventoryApi.searchItems(
        query,
        20,
        undefined,
        trackInventoryOnly ? { trackInventory: true } : undefined
      );
      setSearchResults(results);
    } catch (error) {
      console.error('Item search failed', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputBlur = async () => {
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    if (selectedItem && inputValue === `${selectedItem.code} - ${selectedItem.name}`) {
      return;
    }

    try {
      const exactResults = await inventoryApi.searchItems(
        inputValue,
        1,
        undefined,
        trackInventoryOnly ? { trackInventory: true } : undefined
      );

      if (
        exactResults.length > 0 &&
        (exactResults[0].code.toLowerCase() === inputValue.toLowerCase() ||
          exactResults[0].name.toLowerCase() === inputValue.toLowerCase())
      ) {
        handleSelect(exactResults[0]);
      } else {
        setHighlightedIndex(0);
        setModalSearch(inputValue);
        setShowModal(true);
      }
    } catch (error) {
      setHighlightedIndex(0);
      setModalSearch(inputValue);
      setShowModal(true);
    }

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
    setCreateError('');
    const seed = buildCreateSeed(modalSearch || inputValue, currencyOptions[0]?.code || 'USD');
    const selectedUom = uoms.find((uom) => uom.code === seed.baseUom) || uoms[0];
    setCreateForm({
      ...seed,
      baseUomId: selectedUom?.id,
      baseUom: selectedUom?.code || seed.baseUom,
    });
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
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('itemSelector.placeholder', 'Select item...')}
          disabled={disabled}
          className={`w-full text-xs transition-all duration-200
            ${noBorder ? 'border-none bg-transparent p-1 pl-8' : 'rounded-lg border border-slate-200 bg-white p-2 pl-8 pr-10 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'}
            focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none
            ${disabled ? 'cursor-not-allowed opacity-50 bg-slate-50' : ''}`}
        />
        {!disabled && inputValue && (
          <button type="button" onClick={handleClear} className="absolute right-2 text-slate-400 hover:text-slate-600">
            <X size={14} />
          </button>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[1px]" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto flex max-h-[500px] w-full max-w-lg flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
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
                    if (e.key === 'ArrowDown') setHighlightedIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
                    if (e.key === 'ArrowUp') setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    if (e.key === 'Enter' && searchResults[highlightedIndex]) handleSelect(searchResults[highlightedIndex]);
                    if (e.key === 'Enter' && searchResults.length === 0 && modalSearch.trim()) handleOpenCreateModal();
                    if (e.key === 'Escape') setShowModal(false);
                  }}
                />
                {isLoading && <RefreshCw size={14} className="animate-spin text-indigo-500" />}
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                {searchResults.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center p-8 text-center">
                    <Box size={32} className="mb-2 text-slate-200" />
                    <p className="text-sm text-slate-500">No items found matching "{modalSearch}"</p>
                    <button
                      type="button"
                      onClick={handleOpenCreateModal}
                      className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                    >
                      <Plus size={14} /> Create New Item
                    </button>
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
          <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-[1px]" onClick={() => setShowCreateModal(false)} />
          <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create New Item</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {trackInventoryOnly
                      ? 'This selector creates stock-tracked items only.'
                      : 'Create the item here and it will be selected automatically.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form className="grid gap-4 p-5 md:grid-cols-2" onSubmit={handleCreateItem}>
                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">Code</div>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={createForm.code}
                    onChange={(e) => setCreateForm((current) => ({ ...current, code: e.target.value }))}
                    placeholder="ITEM-001"
                    required
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">Name</div>
                  <input
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((current) => ({ ...current, name: e.target.value }))}
                    placeholder="Stock item name"
                    required
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">Type</div>
                  <select
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    value={createForm.type}
                    onChange={(e) => {
                      const nextType = e.target.value as InventoryItemDTO['type'];
                      setCreateForm((current) => ({
                        ...current,
                        type: nextType,
                        trackInventory: trackInventoryOnly ? true : nextType === 'SERVICE' ? false : current.trackInventory,
                      }));
                    }}
                  >
                    <option value="PRODUCT">PRODUCT</option>
                    <option value="RAW_MATERIAL">RAW_MATERIAL</option>
                    {!trackInventoryOnly && <option value="SERVICE">SERVICE</option>}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">Base UoM</div>
                  {uoms.length > 0 ? (
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={createForm.baseUomId || ''}
                      onChange={(e) => {
                        const selected = uoms.find((uom) => uom.id === e.target.value);
                        setCreateForm((current) => ({
                          ...current,
                          baseUomId: selected?.id,
                          baseUom: selected?.code || current.baseUom,
                        }));
                      }}
                      required
                    >
                      <option value="">Select UoM</option>
                      {uoms.map((uom) => (
                        <option key={uom.id} value={uom.id}>
                          {uom.code} - {uom.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={createForm.baseUom}
                      onChange={(e) => setCreateForm((current) => ({ ...current, baseUom: e.target.value.toUpperCase() }))}
                      placeholder="PCS"
                      required
                    />
                  )}
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium text-slate-700 dark:text-slate-200">Cost Currency</div>
                  {currencyOptions.length > 0 ? (
                    <select
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={createForm.costCurrency}
                      onChange={(e) => setCreateForm((current) => ({ ...current, costCurrency: e.target.value }))}
                    >
                      {currencyOptions.map((currency) => (
                        <option key={currency.code} value={currency.code}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      value={createForm.costCurrency}
                      onChange={(e) => setCreateForm((current) => ({ ...current, costCurrency: e.target.value.toUpperCase() }))}
                      placeholder="USD"
                      required
                    />
                  )}
                </label>

                <label className="md:col-span-2 flex items-center gap-3 rounded border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={trackInventoryOnly ? true : createForm.trackInventory}
                    disabled={trackInventoryOnly || createForm.type === 'SERVICE'}
                    onChange={(e) => setCreateForm((current) => ({ ...current, trackInventory: e.target.checked }))}
                  />
                  <span>
                    {trackInventoryOnly
                      ? 'Track Inventory is required for items created from Opening Stock.'
                      : 'Track inventory for stock-controlled items.'}
                  </span>
                </label>

                {createError && (
                  <div className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {createError}
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {isCreating ? 'Creating...' : 'Create Item'}
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

ItemSelector.displayName = 'ItemSelector';
