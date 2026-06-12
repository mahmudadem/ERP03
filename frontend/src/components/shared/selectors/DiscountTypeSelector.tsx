import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSelectorModalFocus } from './useSelectorModalFocus';

export type DiscountTypeValue = 'PERCENT' | 'AMOUNT';

interface DiscountTypeSelectorProps {
  value?: DiscountTypeValue;
  onChange: (value: DiscountTypeValue | null) => void;
  currencyCode?: string;
  disabled?: boolean;
  noBorder?: boolean;
  className?: string;
}

interface Option {
  value: DiscountTypeValue | null;
  symbol: string;
  display: string;
  labelKey: string;
  fallback: string;
  keywords: string[];
}

const tokenToType = (token: string, options: Option[]): Option | null => {
  const t = token.trim().toUpperCase();
  if (!t) return options.find((o) => o.value === null) || null;
  for (const opt of options) {
    if (opt.symbol.toUpperCase() === t) return opt;
    if (opt.display.toUpperCase() === t) return opt;
    if (opt.fallback.toUpperCase() === t) return opt;
    if (opt.keywords.some((kw) => kw.startsWith(t))) return opt;
  }
  return null;
};

const displayFor = (value: DiscountTypeValue | undefined, options: Option[]): string => {
  const found = options.find((o) => o.value === (value ?? null));
  return found?.display || '';
};

export function DiscountTypeSelector({
  value,
  onChange,
  currencyCode,
  disabled = false,
  noBorder = false,
  className = '',
}: DiscountTypeSelectorProps) {
  const { t } = useTranslation('common');
  const amountSymbol = (currencyCode || '$').trim().toUpperCase() || '$';
  const options: Option[] = useMemo(() => ([
    {
      value: null,
      symbol: '—',
      display: '',
      labelKey: 'discountTypeSelector.none',
      fallback: 'No Discount',
      keywords: ['NONE', 'NO', 'N'],
    },
    {
      value: 'PERCENT',
      symbol: '%',
      display: '% Percent',
      labelKey: 'discountTypeSelector.percent',
      fallback: 'Percent',
      keywords: ['PERCENT', 'PERCENTAGE', 'PCT', 'PRECENT', 'P', '%'],
    },
    {
      value: 'AMOUNT',
      symbol: amountSymbol,
      display: `Amount - ${amountSymbol}`,
      labelKey: 'discountTypeSelector.amount',
      fallback: 'Amount',
      keywords: ['AMOUNT', 'AMT', 'A', '$', amountSymbol],
    },
  ]), [amountSymbol]);

  const [inputValue, setInputValue] = useState(displayFor(value, options));
  const [modalOpen, setModalOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { modalRef, handleKeyDown: handleFocusTrapKeyDown } = useSelectorModalFocus(
    modalOpen,
    () => setModalOpen(false),
    inputRef
  );

  useEffect(() => {
    setInputValue(displayFor(value, options));
  }, [value, options]);

  const selectOption = (option: Option, { refocus = true }: { refocus?: boolean } = {}) => {
    onChange(option.value);
    setInputValue(option.display);
    setModalOpen(false);
    if (refocus) inputRef.current?.focus();
  };

  const openPicker = () => {
    const currentIndex = options.findIndex((option) => option.value === (value ?? null));
    setHighlightedIndex(Math.max(0, currentIndex));
    setModalOpen(true);
  };

  const commit = () => {
    const matched = tokenToType(inputValue, options);
    if (matched) {
      selectOption(matched, { refocus: false });
    } else {
      // Unrecognized input → open picker so user can choose visually.
      openPicker();
    }
  };

  return (
    <>
      <div className={`relative flex items-center ${className}`}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder="—"
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              openPicker();
            }
          }}
          className={`h-9 w-full bg-transparent px-2 pr-7 text-center uppercase text-slate-900 outline-none dark:text-slate-100 ${
            noBorder
              ? 'border-0 [font-size:inherit] [font-family:inherit] focus:bg-blue-50/40 dark:focus:bg-blue-950/20'
              : 'text-xs rounded border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900'
          }`}
        />
        {!disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={openPicker}
            className="absolute right-1 inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={t('discountTypeSelector.open', 'Select discount type')}
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
                  setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
                  return;
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                  return;
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  selectOption(options[highlightedIndex]);
                  return;
                }
                handleFocusTrapKeyDown(event);
              }}
              className="pointer-events-auto flex w-full max-w-xs flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 p-3 dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {t('discountTypeSelector.title', 'Discount type')}
                </span>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  title={t('discountTypeSelector.close', 'Close')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 p-1">
                {options.map((opt, index) => {
                  const isActive = (value ?? null) === opt.value;
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => selectOption(opt)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`flex w-full items-center justify-between rounded px-4 py-3 text-left transition-colors ${
                        isActive || isHighlighted
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="font-mono text-base font-bold">{opt.symbol}</span>
                      <span className="text-xs font-semibold uppercase">{t(opt.labelKey, opt.fallback)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default DiscountTypeSelector;
