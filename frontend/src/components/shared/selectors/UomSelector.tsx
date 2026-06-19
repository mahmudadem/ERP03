import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { inventoryApi, InventoryItemDTO, UomConversionDTO } from '../../../api/inventoryApi';
import {
  buildItemUomOptions,
  findItemUomOption,
  getDefaultItemUomOption,
  ManagedUomOption,
} from '../../../modules/inventory/utils/uomOptions';
import { useSelectorModalFocus } from './useSelectorModalFocus';

interface UomSelectorProps {
  item?: InventoryItemDTO | null;
  itemId?: string;
  valueId?: string;
  valueCode?: string;
  usage: 'sales' | 'purchase';
  onChange: (uom: ManagedUomOption | null) => void;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
  placeholder?: string;
}

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();
const unwrapApiPayload = <T,>(payload: any): T => (payload?.data?.data ?? payload?.data ?? payload) as T;

export function UomSelector({
  item,
  itemId,
  valueId,
  valueCode,
  usage,
  onChange,
  disabled = false,
  noBorder = false,
  className = '',
  placeholder,
}: UomSelectorProps) {
  const { t } = useTranslation('common');
  const [currentItem, setCurrentItem] = useState<InventoryItemDTO | null>(item || null);
  const [conversions, setConversions] = useState<UomConversionDTO[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    modalOpen,
    () => setModalOpen(false),
    inputRef
  );

  const effectiveItemId = item?.id || itemId || '';
  const options = useMemo(() => buildItemUomOptions(currentItem, conversions), [conversions, currentItem]);
  const selected = useMemo(() => findItemUomOption(options, valueId, valueCode), [options, valueCode, valueId]);
  const matches = useMemo(() => {
    const query = normalize(modalSearch);
    if (!query) return options;
    return options.filter((option) => normalize(option.code).includes(query) || normalize(option.label).includes(query));
  }, [modalSearch, options]);

  useEffect(() => {
    setCurrentItem(item || null);
  }, [item]);

  useEffect(() => {
    setInputValue(selected?.code || normalize(valueCode));
  }, [selected?.code, valueCode]);

  const loadItemUoms = async (force = false) => {
    if (!effectiveItemId || loading) return;
    if (!force && currentItem?.id === effectiveItemId && conversions.length > 0) return;
    setLoading(true);
    try {
      const [freshItem, freshConversions] = await Promise.all([
        currentItem?.id === effectiveItemId && !force ? Promise.resolve(currentItem) : inventoryApi.getItem(effectiveItemId),
        inventoryApi.listUomConversions(effectiveItemId),
      ]);
      const nextItem = unwrapApiPayload<InventoryItemDTO | null>(freshItem);
      const nextConversions = unwrapApiPayload<UomConversionDTO[]>(freshConversions);
      setCurrentItem(nextItem || null);
      setConversions(Array.isArray(nextConversions) ? nextConversions : []);
    } catch (error) {
      console.error('Failed to load item UOMs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveItemId) {
      setCurrentItem(null);
      setConversions([]);
      return;
    }
    void loadItemUoms();
    // loadItemUoms intentionally reads current state; effective item changes are the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveItemId]);

  useEffect(() => {
    if (!currentItem || selected || valueCode) return;
    const defaultUom = getDefaultItemUomOption(currentItem, usage);
    if (defaultUom) onChange(defaultUom);
  }, [currentItem, onChange, selected, usage, valueCode]);

  const selectOption = (option: ManagedUomOption, { refocus = true }: { refocus?: boolean } = {}) => {
    onChange(option);
    setInputValue(option.code);
    setModalOpen(false);
    if (refocus) inputRef.current?.focus();
  };

  const openPicker = (seed = inputValue) => {
    if (!currentItem) return;
    setModalSearch(seed);
    const index = matches.findIndex((option) => selected?.code === option.code);
    setHighlightedIndex(Math.max(0, index));
    setModalOpen(true);
  };

  const resolveInput = () => {
    const query = normalize(inputValue);
    if (!query) {
      onChange(null);
      return;
    }
    const exactMatches = options.filter((option) => normalize(option.code) === query || normalize(option.label) === query);
    const fuzzyMatches = options.filter((option) => normalize(option.code).includes(query) || normalize(option.label).includes(query));
    const nextMatches = exactMatches.length ? exactMatches : fuzzyMatches;
    if (nextMatches.length === 1) {
      selectOption(nextMatches[0], { refocus: false });
      return;
    }
    openPicker(query);
  };

  const itemCardPath = effectiveItemId ? `/inventory/items/${effectiveItemId}` : '/inventory/items';

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled || !effectiveItemId}
          placeholder={placeholder || t('uomSelector.placeholder', 'UOM')}
          onChange={(event) => setInputValue(normalize(event.target.value))}
          onFocus={(event) => {
            try { event.currentTarget.select(); } catch { /* noop */ }
            void loadItemUoms();
          }}
          onBlur={resolveInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              resolveInput();
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openPicker();
            }
          }}
          className={`h-9 w-full bg-transparent px-2 pr-8 uppercase text-slate-900 outline-none transition-colors dark:text-slate-100 ${
            noBorder
              ? 'border-0 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20'
              : 'text-xs rounded border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900'
          } ${!effectiveItemId ? 'cursor-not-allowed text-transparent' : ''}`}
        />
        {!disabled && effectiveItemId && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openPicker()}
            className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={t('uomSelector.open', 'Select UOM')}
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {modalOpen && currentItem && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]" onClick={() => setModalOpen(false)} />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              ref={modalRef}
              tabIndex={-1}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(matches.length - 1, 0)));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                  return;
                }
                if (event.key === 'Enter' && matches[highlightedIndex]) {
                  event.preventDefault();
                  selectOption(matches[highlightedIndex]);
                  return;
                }
                handleFocusTrapKeyDown(event);
              }}
              className="pointer-events-auto flex max-h-[480px] w-full max-w-md flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-slate-800">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  autoFocus
                  value={modalSearch}
                  onChange={(event) => {
                    setModalSearch(event.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && matches.length === 1) {
                      event.preventDefault();
                      selectOption(matches[0]);
                    }
                  }}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm uppercase outline-none"
                  placeholder={t('uomSelector.searchPlaceholder', 'Search item UOMs')}
                />
                <button
                  type="button"
                  onClick={() => void loadItemUoms(true)}
                  disabled={loading}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title={t('uomSelector.refresh', 'Refresh item UOMs')}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title={t('uomSelector.close', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                  {currentItem.code} - {currentItem.name}
                </div>
                <Link
                  to={itemCardPath}
                  target="_blank"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                >
                  {t('uomSelector.openItemCard', 'Open item card to edit UOMs')}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-1">
                {matches.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {t('uomSelector.noMatches', 'No UOM matches this item. Edit the item card to maintain UOMs.')}
                  </div>
                ) : (
                  matches.map((option, index) => (
                    <button
                      key={option.uomId || option.code}
                      type="button"
                      onClick={() => selectOption(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-3 text-left transition-colors ${
                        selected?.code === option.code || highlightedIndex === index
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-mono text-sm font-bold uppercase">{option.code}</span>
                      <span className="text-[10px] font-bold uppercase text-slate-400">{option.uomId ? 'Item UOM' : 'Code'}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default UomSelector;
