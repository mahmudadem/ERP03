import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, GripVertical, Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { ResponsiveColumn, SortDirection, ActiveFilters } from './types';
import { DataTableFilter } from './DataTableFilter';

const MIN_COLUMN_WIDTH = 50;

interface DataTableHeaderProps<T> {
  columns: ResponsiveColumn<T>[];
  sorting?: { field: string; direction: SortDirection };
  onSort?: (field: string) => void;
  sortCycle?: 'toggle' | 'cycle';
  sticky?: boolean;
  fontSize: 'sm' | 'md' | 'lg';
  selectable?: boolean;
  allSelected?: boolean;
  someSelected?: boolean;
  onSelectAll?: () => void;
  expandable?: boolean;
  allExpanded?: boolean;
  onToggleExpandAll?: () => void;
  resizable?: boolean;
  onColumnResize?: (columnKey: string, newWidth: number) => void;
  onFilterChange?: (columnKey: string, value: ActiveFilters[string] | undefined) => void;
  activeFilters?: ActiveFilters;
  hasRowActions?: boolean;
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
  sortCycle = 'toggle',
  sticky,
  fontSize,
  selectable,
  allSelected,
  someSelected,
  onSelectAll,
  expandable,
  allExpanded,
  onToggleExpandAll,
  resizable,
  onColumnResize,
  onFilterChange,
  activeFilters,
  hasRowActions,
}: DataTableHeaderProps<T>) {
  const fontClass = FONT_SIZE_MAP[fontSize];

  const renderSortIcon = (colKey: string, direction: SortDirection) => {
    if (!sorting || sorting.field !== colKey) {
      return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    }
    if (direction === 'asc') return <ArrowUp className="w-3 h-3" />;
    if (direction === 'desc') return <ArrowDown className="w-3 h-3" />;
    return <ArrowUpDown className="w-3 h-3 opacity-30" />;
  };

  const handleSort = (colKey: string) => {
    if (!onSort) return;
    if (sortCycle === 'cycle') {
      if (sorting?.field !== colKey) {
        onSort(colKey);
      } else if (sorting.direction === 'asc') {
        onSort(colKey);
      } else if (sorting.direction === 'desc') {
        onSort(colKey);
      }
    } else {
      onSort(colKey);
    }
  };

  const checkboxState = someSelected && !allSelected ? 'some' : allSelected ? 'all' : 'none';

  return (
    <thead
      className={clsx(
        'bg-[var(--color-bg-secondary)] select-none',
        sticky && 'sticky top-0 z-10'
      )}
    >
      <tr className="divide-x divide-[var(--color-border)]/50">
        {expandable && (
          <th
            className={clsx(
              'px-2 py-3 w-10 text-center',
              sticky && 'sticky top-0 z-20 bg-[var(--color-bg-secondary)]',
              fontClass
            )}
          >
            {onToggleExpandAll && (
              <button
                onClick={onToggleExpandAll}
                className="p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                title={allExpanded ? 'Collapse all' : 'Expand all'}
              >
                {allExpanded
                  ? <ArrowUp className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  : <ArrowDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                }
              </button>
            )}
          </th>
        )}

        {selectable && (
          <th
            className={clsx(
              'px-2 py-3 w-10 text-center',
              sticky && 'sticky top-0 z-20 bg-[var(--color-bg-secondary)]',
              fontClass
            )}
          >
            {onSelectAll && (
              <Checkbox
                state={checkboxState}
                onChange={onSelectAll}
              />
            )}
          </th>
        )}

        {columns.map(col => {
          const alignClass = col.align === 'center'
            ? 'text-center'
            : col.align === 'right'
              ? 'text-right'
              : 'text-left';

          const isSortable = col.sortable && !!onSort;
          const currentDirection = sorting?.field === col.key ? sorting.direction : null;
          const stickyClass = col.sticky ? `sticky-${col.sticky} bg-[var(--color-bg-secondary)] z-20` : '';
          const colWidth = col.computedWidth;

          return (
            <th
              key={col.key}
              className={clsx(
                'px-3 py-3 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group',
                alignClass,
                fontClass,
                isSortable && 'cursor-pointer hover:text-[var(--color-text-primary)] transition-colors',
                stickyClass,
                col.headerClassName
              )}
              style={{ width: colWidth }}
              onClick={() => isSortable && handleSort(col.key)}
              role={isSortable ? 'columnheader button' : 'columnheader'}
              aria-sort={
                sorting?.field === col.key
                  ? sorting.direction === 'asc' ? 'ascending' : sorting.direction === 'desc' ? 'descending' : 'none'
                  : 'none'
              }
              tabIndex={isSortable ? 0 : undefined}
              onKeyDown={e => {
                if (isSortable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleSort(col.key);
                }
              }}
            >
              <div className="flex items-center gap-1.5">
                {col.sticky === 'left' && <GripVertical className="w-3 h-3 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-50 shrink-0" />}
                <span className="truncate flex-1">{col.label}</span>
                {col.filter && onFilterChange && (
                  <DataTableFilter
                    columnKey={col.key}
                    label={col.label}
                    config={col.filter}
                    activeFilter={activeFilters?.[col.key]}
                    onFilterChange={onFilterChange}
                  />
                )}
                {isSortable && (
                  <span className="shrink-0">
                    {renderSortIcon(col.key, currentDirection)}
                  </span>
                )}
              </div>

              {resizable && col.resizable !== false && (
                <ColumnResizeHandle
                  columnKey={col.key}
                  onResize={onColumnResize}
                />
              )}
            </th>
          );
        })}

        {hasRowActions && (
          <th
            className={clsx(
              'px-3 py-3 w-20 text-center text-[var(--color-text-secondary)] uppercase tracking-wider',
              sticky && 'sticky top-0 z-20 bg-[var(--color-bg-secondary)]',
              fontClass
            )}
          >
            Actions
          </th>
        )}
      </tr>
    </thead>
  );
}

// ── Checkbox Sub-component ───────────────────────────────────────────

function Checkbox({ state, onChange }: {
  state: 'none' | 'some' | 'all';
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
      style={{
        borderColor: state === 'none' ? 'var(--color-border)' : 'var(--color-primary-600, #4f46e5)',
        backgroundColor: state === 'all' || state === 'some' ? 'var(--color-primary-600, #4f46e5)' : 'transparent',
      }}
      aria-label={state === 'all' ? 'Deselect all' : 'Select all'}
    >
      {state === 'all' && (
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {state === 'some' && (
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

// ── Column Resize Handle ─────────────────────────────────────────────

function ColumnResizeHandle({ columnKey, onResize }: {
  columnKey: string;
  onResize?: (columnKey: string, newWidth: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const thRef = useRef<HTMLTableCellElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onResize || !thRef.current) return;

    const th = thRef.current.parentElement as HTMLElement;
    startX.current = e.clientX;
    startWidth.current = th.offsetWidth;
    setDragging(true);

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth.current + delta);
      onResize(columnKey, newWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnKey, onResize]);

  return (
    <div
      ref={thRef}
      onMouseDown={handleMouseDown}
      className={clsx(
        'absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary-400/40 transition-colors z-30',
        dragging && 'bg-primary-500/60'
      )}
    />
  );
}
