import React, { useState, useRef, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { X, Search, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { ColumnFilterConfig, FilterOption, ActiveFilters } from './types';
import { DatePicker } from '../../shared/selectors';
import { useTranslation } from "react-i18next";

interface DataTableFilterProps {
  columnKey: string;
  label: string;
  config: ColumnFilterConfig;
  activeFilter?: ActiveFilters[string];
  onFilterChange: (columnKey: string, value: ActiveFilters[string] | undefined) => void;
}

export function DataTableFilter({
  columnKey,
  label,
  config,
  activeFilter,
  onFilterChange,
}: DataTableFilterProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const hasActiveFilter = activeFilter !== undefined && (
    typeof activeFilter === 'string' ? activeFilter.length > 0 :
    Array.isArray(activeFilter) ? activeFilter.length > 0 :
    Object.values(activeFilter).some(v => v !== undefined && v !== '')
  );

  const renderContent = () => {
    switch (config.type) {
      case 'text':
        return (
          <TextFilter
            value={typeof activeFilter === 'string' ? activeFilter : ''}
            placeholder={config.placeholder || `Filter ${label}...`}
            onChange={val => onFilterChange(columnKey, val || undefined)}
          />
        );
      case 'number-range':
        return (
          <NumberRangeFilter
            value={typeof activeFilter === 'object' && !Array.isArray(activeFilter) ? activeFilter as { min?: number; max?: number } : {}}
            onChange={val => onFilterChange(columnKey, val)}
          />
        );
      case 'date-range':
        return (
          <DateRangeFilter
            value={typeof activeFilter === 'object' && !Array.isArray(activeFilter) ? activeFilter as { from?: string; to?: string } : {}}
            onChange={val => onFilterChange(columnKey, val)}
          />
        );
      case 'multi-select':
        return (
          <MultiSelectFilter
            options={config.options || []}
            value={Array.isArray(activeFilter) ? activeFilter : []}
            onChange={val => onFilterChange(columnKey, val.length > 0 ? val : undefined)}
          />
        );
      case 'single-select':
        return (
          <SingleSelectFilter
            options={config.options || []}
            value={typeof activeFilter === 'string' ? activeFilter : ''}
            onChange={val => onFilterChange(columnKey, val || undefined)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className={clsx(
          'p-1 rounded transition-colors',
          hasActiveFilter
            ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
        )}
        title={`Filter by ${label}`}
      >
        <Search className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute top-full left-0 mt-1 w-56 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-lg z-[200] p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {label}
            </span>
            {hasActiveFilter && (
              <button
                onClick={() => onFilterChange(columnKey, undefined)}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>
          {renderContent()}
        </div>
      )}
    </div>
  );
}

// ── Text Filter ──────────────────────────────────────────────────────

function TextFilter({ value, placeholder, onChange }: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary-500"
        autoFocus
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[var(--color-bg-secondary)] rounded"
        >
          <X className="w-3 h-3 text-[var(--color-text-muted)]" />
        </button>
      )}
    </div>
  );
}

// ── Number Range Filter ──────────────────────────────────────────────

function NumberRangeFilter({ value, onChange }: {
  value: { min?: number; max?: number };
  onChange: (val: { min?: number; max?: number }) => void;
}) {
  return (
    <div className="flex gap-2">
      <input
        type="number"
        value={value.min ?? ''}
        onChange={e => onChange({ ...value, min: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Min"
        className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary-500"
      />
      <input
        type="number"
        value={value.max ?? ''}
        onChange={e => onChange({ ...value, max: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Max"
        className="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary-500"
      />
    </div>
  );
}

// ── Date Range Filter ────────────────────────────────────────────────

function DateRangeFilter({ value, onChange }: {
  value: { from?: string; to?: string };
  onChange: (val: { from?: string; to?: string }) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <DatePicker
          value={value.from ?? ''}
          onChange={from => onChange({ ...value, from: from || undefined })}
          className="flex-1"
          inputClassName="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <DatePicker
          value={value.to ?? ''}
          onChange={to => onChange({ ...value, to: to || undefined })}
          className="flex-1"
          inputClassName="w-full px-2 py-1.5 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>
    </div>
  );
}

// ── Multi-Select Filter ──────────────────────────────────────────────

function MultiSelectFilter({ options, value, onChange }: {
  options: FilterOption[];
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter(v => v !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <div className="max-h-40 overflow-y-auto space-y-0.5">
      {options.map(opt => {
        const checked = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={clsx(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
              checked
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
            )}
          >
            <span className={clsx(
              'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
              checked
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-[var(--color-border)]'
            )}>
              {checked && <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Single-Select Filter ─────────────────────────────────────────────

function SingleSelectFilter({ options, value, onChange }: {
  options: FilterOption[];
  value: string;
  onChange: (val: string) => void;
}) {
    const { t } = useTranslation('common');
  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onChange('')}
        className={clsx(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
          !value
            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
            : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
        )}
      >
        <span className={clsx(
          'w-3.5 h-3.5 rounded-full border shrink-0',
          !value ? 'border-primary-600 bg-primary-600' : 'border-[var(--color-border)]'
        )} />
        <span>{t(`All`)}</span>
      </button>
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors',
              selected
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
            )}
          >
            <span className={clsx(
              'w-3.5 h-3.5 rounded-full border shrink-0',
              selected ? 'border-primary-600 bg-primary-600' : 'border-[var(--color-border)]'
            )} />
            <span className="truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
