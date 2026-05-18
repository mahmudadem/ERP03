import React from 'react';
import { clsx } from 'clsx';
import { ResponsiveColumn } from './types';

interface DataTableBodyProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  idKey?: keyof T | ((row: T) => string);
  fontSize: 'sm' | 'md' | 'lg';
}

const FONT_SIZE_MAP = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const SKELETON_ROWS = 5;

function getRowId<T>(row: T, idKey: keyof T | ((row: T) => string) | undefined, index: number): string {
  if (typeof idKey === 'function') return idKey(row);
  if (idKey) return String((row as any)[idKey]);
  return `row-${index}`;
}

function getCellValue<T>(row: T, col: ResponsiveColumn<T>): any {
  if (col.accessor) {
    if (typeof col.accessor === 'function') {
      return col.accessor(row);
    }
    return (row as any)[col.accessor];
  }
  return undefined;
}

export function DataTableBody<T>({
  columns,
  data,
  loading,
  emptyMessage,
  onRowClick,
  idKey,
  fontSize,
}: DataTableBodyProps<T>) {
  const fontClass = FONT_SIZE_MAP[fontSize];

  if (loading) {
    return (
      <tbody>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <tr key={`skeleton-${i}`} className="animate-pulse">
            {columns.map(col => (
              <td
                key={col.key}
                className="px-3 py-3"
                style={{ width: col.computedWidth }}
              >
                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    );
  }

  if (data.length === 0) {
    return (
      <tbody>
        <tr>
          <td
            colSpan={columns.length}
            className="px-6 py-12 text-center text-[var(--color-text-muted)]"
          >
            {emptyMessage || 'No data available'}
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)]">
      {data.map((row, index) => {
        const rowId = getRowId(row, idKey, index);
        const isClickable = !!onRowClick;

        return (
          <tr
            key={rowId}
            className={clsx(
              'transition-colors',
              isClickable && 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/10',
              index % 2 === 0 ? 'bg-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-secondary)]/30'
            )}
            onClick={() => onRowClick?.(row, index)}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={e => {
              if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onRowClick(row, index);
              }
            }}
          >
            {columns.map(col => {
              const alignClass = col.align === 'center'
                ? 'text-center'
                : col.align === 'right'
                  ? 'text-right'
                  : 'text-left';

              const value = getCellValue(row, col);

              const cellContent = col.render
                ? col.render(value, row, index)
                : value != null
                  ? String(value)
                  : '-';

              return (
                <td
                  key={col.key}
                  className={clsx(
                    'px-3 py-3 text-[var(--color-text-primary)]',
                    alignClass,
                    fontClass,
                    col.truncate && 'truncate',
                    col.className
                  )}
                  style={{ width: col.computedWidth }}
                  title={col.truncate && typeof cellContent === 'string' ? cellContent : undefined}
                >
                  {col.truncate && typeof cellContent === 'string' ? (
                    <span className="block truncate" title={cellContent}>
                      {cellContent}
                    </span>
                  ) : (
                    cellContent
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
}
