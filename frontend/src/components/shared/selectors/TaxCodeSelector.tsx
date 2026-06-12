import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelectorModalFocus } from './useSelectorModalFocus';

export interface TaxCodeOption {
  id: string;
  code: string;
  name?: string;
  rate: number;
}

interface TaxCodeSelectorProps {
  options: TaxCodeOption[];
  valueId?: string;
  onChange: (option: TaxCodeOption | null) => void;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
  placeholder?: string;
  /**
   * Shown inside the picker when `options.length === 0`. Useful for nudging
   * the user to set up scoped tax codes (e.g. PI needs `PURCHASE`/`BOTH`,
   * SI needs `SALES`/`BOTH`) without having to leave the document.
   */
  emptySetupMessage?: string;
}

const normalize = (value?: string | null) => (value || '').trim().toUpperCase();

export function TaxCodeSelector({
  options,
  valueId,
  onChange,
  disabled = false,
  noBorder = false,
  className = '',
  placeholder,
  emptySetupMessage,
}: TaxCodeSelectorProps) {
  const { t } = useTranslation('common');
  const [inputValue, setInputValue] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    modalOpen,
    () => setModalOpen(false),
    inputRef
  );

  const selected = useMemo(() => options.find((opt) => opt.id === valueId) || null, [options, valueId]);
  const matches = useMemo(() => {
    const query = normalize(modalSearch);
    if (!query) return options;
    return options.filter((opt) => normalize(opt.code).includes(query) || normalize(opt.name).includes(query));
  }, [modalSearch, options]);

  useEffect(() => {
    setInputValue(selected?.name || selected?.code || '');
  }, [selected?.code, selected?.name]);

  const selectOption = (option: TaxCodeOption | null, { refocus = true }: { refocus?: boolean } = {}) => {
    onChange(option);
    setInputValue(option?.name || option?.code || '');
    setModalOpen(false);
    if (refocus) inputRef.current?.focus();
  };

  const openPicker = (seed = inputValue) => {
    const selectedIndex = matches.findIndex((option) => option.id === valueId);
    setHighlightedIndex(Math.max(0, selectedIndex));
    setModalSearch(seed);
    setModalOpen(true);
  };

  const resolveInput = () => {
    const query = normalize(inputValue);
    if (!query) {
      selectOption(null, { refocus: false });
      return;
    }
    if (selected && (normalize(selected.name) === query || normalize(selected.code) === query)) {
      setInputValue(selected.name || selected.code);
      return;
    }
    const exact = options.find((opt) => normalize(opt.code) === query);
    if (exact) {
      selectOption(exact, { refocus: false });
      return;
    }
    const fuzzy = options.filter((opt) => normalize(opt.code).includes(query) || normalize(opt.name).includes(query));
    if (fuzzy.length === 1) {
      selectOption(fuzzy[0], { refocus: false });
      return;
    }
    openPicker(query);
  };

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder || t('taxCodeSelector.placeholder', 'Tax')}
          onChange={(event) => setInputValue(normalize(event.target.value))}
          onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
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
          className={`h-9 w-full bg-transparent px-2 pr-7 uppercase text-slate-900 outline-none transition-colors dark:text-slate-100 ${
            noBorder
              ? 'border-0 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20'
              : 'text-xs rounded border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900'
          }`}
        />
        {!disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => openPicker()}
            className="absolute right-1 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={t('taxCodeSelector.open', 'Select tax code')}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {modalOpen && (
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
                  placeholder={t('taxCodeSelector.searchPlaceholder', 'Search tax codes')}
                />
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title={t('taxCodeSelector.close', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                <button
                  type="button"
                  onClick={() => selectOption(null)}
                  className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-3 text-left transition-colors ${
                    !selected
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-mono text-sm font-bold uppercase">{t('taxCodeSelector.noTax', 'No Tax')}</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">—</span>
                </button>
                {options.length === 0 ? (
                  <div className="m-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-700/50 dark:bg-amber-950/30">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      {emptySetupMessage || t('taxCodeSelector.noSetup', 'No tax codes available for this document.')}
                    </p>
                    <Link
                      to="/settings/tax-codes"
                      target="_blank"
                      onClick={() => setModalOpen(false)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline dark:text-indigo-300"
                    >
                      {t('taxCodeSelector.openTaxCodes', 'Open Tax Codes settings')}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ) : matches.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    {t('taxCodeSelector.noMatches', 'No tax codes match your search.')}
                  </div>
                ) : (
                  matches.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => selectOption(option)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full cursor-pointer items-center justify-between rounded px-4 py-3 text-left transition-colors ${
                        selected?.id === option.id || highlightedIndex === index
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{option.name || option.code}</span>
                        <span className="block font-mono text-[10px] font-bold uppercase text-slate-400">{option.code}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase text-slate-400">{Math.round(option.rate * 100)}%</span>
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

export default TaxCodeSelector;
