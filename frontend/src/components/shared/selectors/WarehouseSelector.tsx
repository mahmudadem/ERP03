import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Plus, RefreshCw, Warehouse as WarehouseIcon } from 'lucide-react';
import { inventoryApi, InventoryWarehouseDTO } from '../../../api/inventoryApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { useSelectorModalFocus } from './useSelectorModalFocus';
import WarehouseMasterCard from '../../../modules/inventory/components/WarehouseMasterCard';

interface WarehouseSelectorProps {
  value?: string;  // Warehouse ID or Code
  onChange: (warehouse: InventoryWarehouseDTO | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  noBorder?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onBlur?: () => void;
  warehouses?: InventoryWarehouseDTO[];
}

interface CreateWarehouseFormState {
  name: string;
  code: string;
  address: string;
  parentId: string;
}

const buildCreateSeed = (rawSearch: string): CreateWarehouseFormState => {
  const trimmed = rawSearch.trim();
  const looksLikeCode = !!trimmed && !/\s/.test(trimmed);

  return {
    name: looksLikeCode ? '' : trimmed,
    code: looksLikeCode ? trimmed.toUpperCase() : '',
    address: '',
    parentId: '',
  };
};

export const WarehouseSelector = forwardRef<HTMLInputElement, WarehouseSelectorProps>(({
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  noBorder = false,
  onKeyDown: externalKeyDown,
  onBlur: externalBlur,
  warehouses: providedWarehouses
}, ref) => {
  const { t } = useTranslation('inventory');
  const { hasPermission } = useRBAC();
  const actualPlaceholder = placeholder || t('Select warehouse...', { defaultValue: 'Select warehouse...' });
  const [inputValue, setInputValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState<CreateWarehouseFormState>(() => buildCreateSeed(''));
  const [allWarehouses, setAllWarehouses] = useState<InventoryWarehouseDTO[]>(providedWarehouses || []);
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
  const canCreate = hasPermission('inventory.warehouses.manage');

  // Forward the ref
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const fetchWarehouses = async (showLoadingState = false) => {
    if (showLoadingState) {
      setIsLoading(true);
    }
    setIsRefreshing(true);
    try {
      const data = await inventoryApi.listWarehouses({ active: true });
      setAllWarehouses(data);
    } catch (error) {
      console.error('Failed to fetch warehouses', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (providedWarehouses && providedWarehouses.length > 0) {
      setAllWarehouses(providedWarehouses);
      return;
    }

    fetchWarehouses(true);
  }, []);

  useEffect(() => {
    if (providedWarehouses) {
      setAllWarehouses(providedWarehouses);
    }
  }, [providedWarehouses]);

  useEffect(() => {
    if (showModal && modalInputRef.current) {
      modalInputRef.current.focus();
      modalInputRef.current.select();
    }
  }, [showModal]);

  // Sync input value with external value
  useEffect(() => {
    // Defensive check: if value is an object, try to extract ID
    const normalizedValue = typeof value === 'object' && value !== null 
      ? ((value as any).id || (value as any).code || '') 
      : (value || '');

    if (normalizedValue) {
      const warehouse = allWarehouses.find(w => w.id === normalizedValue || w.code === normalizedValue);
      if (warehouse) {
        setInputValue(`${warehouse.code} - ${warehouse.name}`);
      } else {
        setInputValue(normalizedValue);
      }
    } else {
      setInputValue('');
    }
  }, [value, allWarehouses]);

  const findExactMatch = (searchText: string): InventoryWarehouseDTO | null => {
    const search = searchText.trim().toLowerCase();
    if (!search) return null;

    const codeMatch = allWarehouses.find((warehouse) => warehouse.code.toLowerCase() === search);
    if (codeMatch) return codeMatch;

    const compoundMatch = allWarehouses.find((warehouse) => `${warehouse.code} - ${warehouse.name}`.toLowerCase() === search);
    if (compoundMatch) return compoundMatch;

    return allWarehouses.find((warehouse) => warehouse.name.toLowerCase() === search) || null;
  };

  const getFilteredWarehouses = (searchText: string): InventoryWarehouseDTO[] => {
    const search = searchText.trim().toLowerCase();
    if (!search) return allWarehouses.slice(0, 20);
    
    return allWarehouses
      .filter((warehouse) => {
        const compound = `${warehouse.code} - ${warehouse.name}`.toLowerCase();
        return compound.includes(search);
      })
      .sort((left, right) => {
        const leftCode = left.code.toLowerCase();
        const rightCode = right.code.toLowerCase();

        if (leftCode === search) return -1;
        if (rightCode === search) return 1;
        if (leftCode.startsWith(search) && !rightCode.startsWith(search)) return -1;
        if (rightCode.startsWith(search) && !leftCode.startsWith(search)) return 1;

        return leftCode.localeCompare(rightCode);
      })
      .slice(0, 20);
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      if (value) onChange(null);
      return;
    }

    // Check if it already matches the display format of the selected item
    const warehouse = allWarehouses.find(w => w.id === value || w.code === value);
    if (warehouse && inputValue === `${warehouse.code} - ${warehouse.name}`) {
      return;
    }

    const query = inputValue.toLowerCase().trim();
    const matches = allWarehouses.filter(w => 
      w.code.toLowerCase() === query || 
      w.name.toLowerCase() === query ||
      `${w.code} - ${w.name}`.toLowerCase() === query
    );

    if (matches.length === 1) {
      handleSelect(matches[0]);
    } else {
      const fuzzyMatches = getFilteredWarehouses(inputValue);
      if (fuzzyMatches.length === 1) {
        handleSelect(fuzzyMatches[0]);
      } else {
        setModalSearch(inputValue.trim());
        setHighlightedIndex(0);
        setShowModal(true);
      }
    }

    if (externalBlur) externalBlur();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (inputValue.trim()) {
        const exactMatch = findExactMatch(inputValue);
        if (exactMatch) {
          onChange(exactMatch);
          setInputValue(`${exactMatch.code} - ${exactMatch.name}`);
          if (externalKeyDown) externalKeyDown(e);
        } else if (getFilteredWarehouses(inputValue).length === 1) {
          const [match] = getFilteredWarehouses(inputValue);
          onChange(match);
          setInputValue(`${match.code} - ${match.name}`);
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
    
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (externalKeyDown) externalKeyDown(e);
    }
  };

  const handleSelect = (warehouse: InventoryWarehouseDTO) => {
    onChange(warehouse);
    setInputValue(`${warehouse.code} - ${warehouse.name}`);
    setShowModal(false);
    setShowCreateModal(false);
    setCreateError('');
    inputRef.current?.focus();
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleRefresh = async () => {
    if (disabled || isRefreshing) return;
    await fetchWarehouses(allWarehouses.length === 0);
  };

  const handleOpenCreateModal = () => {
    if (!canCreate) return;

    setShowModal(false);
    setShowCreateModal(true);
  };

  const getCreateErrorMessage = (error: unknown): string => {
    if (typeof error === 'object' && error && 'response' in error) {
      const response = (error as any).response;
      return response?.data?.message || response?.data?.error || 'Failed to create warehouse.';
    }

    if (error instanceof Error) return error.message;
    return 'Failed to create warehouse.';
  };

  const handleCreateWarehouse = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.code.trim()) {
      setCreateError('Warehouse code and name are required.');
      return;
    }

    setIsCreating(true);
    setCreateError('');

    try {
      const created = await inventoryApi.createWarehouse({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase(),
        address: createForm.address.trim() || undefined,
        parentId: createForm.parentId || undefined,
      });

      setAllWarehouses((current) => [created, ...current.filter((warehouse) => warehouse.id !== created.id)]);
      handleSelect(created);
    } catch (error) {
      setCreateError(getCreateErrorMessage(error));
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = getFilteredWarehouses(modalSearch);

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <div className="absolute left-2.5 text-slate-400">
          <WarehouseIcon size={14} />
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
              : 'text-xs p-2 pl-8 pr-16 border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-800 dark:bg-slate-900'}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
        />
        {!disabled && (
          <div className="absolute right-1 flex items-center gap-1">
            {inputValue && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleClear}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-40" onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <div
              ref={modalRef}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.target !== modalInputRef.current) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    return;
                  }
                  if (e.key === 'Enter' && filtered[highlightedIndex]) {
                    e.preventDefault();
                    handleSelect(filtered[highlightedIndex]);
                    return;
                  }
                }
                handleFocusTrapKeyDown(e);
              }}
              className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[450px] pointer-events-auto flex flex-col"
            >
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                <Search size={18} className="text-slate-400" />
                <input
                  ref={modalInputRef}
                  autoFocus
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  placeholder="Search warehouses..."
                  value={modalSearch}
                  onChange={(e) => {
                    setModalSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
                    if (e.key === 'ArrowUp') setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    if (e.key === 'Enter' && filtered[highlightedIndex]) handleSelect(filtered[highlightedIndex]);
                    if (e.key === 'Enter' && filtered.length === 0 && modalSearch.trim() && canCreate) handleOpenCreateModal();
                    if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) e.stopPropagation();
                  }}
                />
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  title="Refresh warehouses"
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
                {canCreate && (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    title="Create new warehouse"
                    className="rounded p-1.5 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
              <div className="overflow-y-auto p-1">
                {isLoading ? (
                  <div className="p-8 text-center text-sm text-slate-500">Loading warehouses...</div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center p-8 text-center">
                    <WarehouseIcon size={32} className="mb-2 text-slate-200" />
                    <p className="text-sm text-slate-500">No warehouses found matching "{modalSearch}"</p>
                    {canCreate && (
                      <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="mt-4 flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                      >
                        <Plus size={14} /> Create New Warehouse
                      </button>
                    )}
                  </div>
                ) : (
                  filtered.map((w, i) => (
                    <div
                      key={w.id}
                      onClick={() => handleSelect(w)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`px-4 py-3 cursor-pointer rounded-lg flex justify-between items-center
                        ${i === highlightedIndex ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{w.name}</span>
                        <span className="text-xs text-slate-500 font-mono">{w.code}</span>
                        {w.address && <span className="text-[11px] text-slate-400">{w.address}</span>}
                      </div>
                      {w.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold uppercase">Default</span>}
                    </div>
                  ))
                )}
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
              className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-950"
            >
              <WarehouseMasterCard
                warehouseId="new"
                isWindow
                onClose={() => setShowCreateModal(false)}
                onSaved={(warehouse) => {
                  setAllWarehouses((current) => [warehouse, ...current.filter((entry) => entry.id !== warehouse.id)]);
                  handleSelect(warehouse);
                  void fetchWarehouses(false);
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
});

WarehouseSelector.displayName = 'WarehouseSelector';

