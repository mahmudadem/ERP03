import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { clsx } from 'clsx';
import { ResponsiveColumn } from './types';

interface DataTableHeaderProps<T> {
  columns: ResponsiveColumn<T>[];
  sorting?: { field: string; direction: 'asc' | 'desc' };
  onSort?: (field: string) => void;
  sticky?: boolean;
  fontSize: 'sm' | 'md' | 'lg';
}

const FONT_SIZE_MAP = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function DataTableHeader<T>({
  columns,
  sorting,
  onSort,
  sticky,
  fontSize,
}: DataTableHeaderProps<T>) {
  const fontClass = FONT_SIZE_MAP[fontSize];

  const renderSortIcon = (colKey: string) => {
    if (!sorting) return null;
    if (sorting.field !== colKey) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    return sorting.direction === 'asc'
      ? <ArrowUp className="w-3 h-3" />
      : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <thead
      className={clsx(
        'bg-[var(--color-bg-secondary)] select-none',
        sticky && 'sticky top-0 z-10'
      )}
    >
      <tr className="divide-x divide-[var(--color-border)]/50">
        {columns.map(col => {
          const alignClass = col.align === 'center'
            ? 'text-center'
            : col.align === 'right'
              ? 'text-right'
              : 'text-left';

          const isSortable = col.sortable && onSort;

          return (
            <th
              key={col.key}
              className={clsx(
                'px-3 py-3 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider',
                alignClass,
                fontClass,
                isSortable && 'cursor-pointer hover:text-[var(--color-text-primary)] transition-colors',
                col.headerClassName
              )}
              style={{ width: col.computedWidth }}
              onClick={() => isSortable && onSort(col.key)}
              role={isSortable ? 'columnheader button' : 'columnheader'}
              aria-sort={
                sorting?.field === col.key
                  ? sorting.direction === 'asc' ? 'ascending' : 'descending'
                  : 'none'
              }
              tabIndex={isSortable ? 0 : undefined}
              onKeyDown={e => {
                if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSort(col.key);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <span className="truncate">{col.label}</span>
                {isSortable && (
                  <span className="shrink-0">
                    {renderSortIcon(col.key)}
                  </span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
