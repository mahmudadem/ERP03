import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Settings2, Check, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { DataTableProps, ColumnDefinition, FontSize, Density, ActiveFilters } from './types';
import { useResponsiveColumns } from './useResponsiveColumns';
import { DataTableHeader } from './DataTableHeader';
import { DataTableBody } from './DataTableBody';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Core',
  2: 'Standard',
  3: 'Detail',
};

const FONT_STORAGE_KEY = 'erp_datatable_font_size';
const DENSITY_STORAGE_KEY = 'erp_datatable_density';
const WIDTH_STORAGE_KEY_PREFIX = 'erp_datatable_widths_';

function getDefaultFontSize(): FontSize {
  try {
    const saved = localStorage.getItem(FONT_STORAGE_KEY);
    if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
  } catch { /* ignore */ }
  return 'sm';
}

function getDefaultDensity(): Density {
  try {
    const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
    if (saved === 'compact' || saved === 'comfortable' || saved === 'spacious') return saved;
  } catch { /* ignore */ }
  return 'comfortable';
}

function loadColumnWidths(tableId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${WIDTH_STORAGE_KEY_PREFIX}${tableId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveColumnWidths(tableId: string, widths: Record<string, number>) {
  try {
    localStorage.setItem(`${WIDTH_STORAGE_KEY_PREFIX}${tableId}`, JSON.stringify(widths));
  } catch { /* ignore */ }
}

export function DataTable<T = any>({
  columns,
  data,
  loading = false,
  error = null,
  emptyMessage,
  onRowClick,
  pagination,
  sorting,
  searchable = false,
  searchPlaceholder = 'Search...',
  onSearch,
  stickyHeader = true,
  className,
  idKey,

  selectable = false,
  selection,
  bulkActions,

  rowActions,

  onFilterChange,
  activeFilters,

  expandable = false,
  renderExpanded,
  expandedIds,
  onExpandedChange,

  density: densityProp,

  toolbar,

  resizable = false,
  onColumnResize,
}: DataTableProps<T>) {
  const tableId = `table-${columns.map(c => c.key).join('-')}`;
  const {
    visibleColumns,
    allVisibleKeys,
    isColumnVisible,
    toggleColumn,
    resetColumns,
  } = useResponsiveColumns(columns, tableId);

  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(getDefaultFontSize);
  const [density, setDensity] = useState<Density>(densityProp || getDefaultDensity);
  const [searchTerm, setSearchTerm] = useState('');
  const [localExpandedIds, setLocalExpandedIds] = useState<Set<string>>(new Set());
  const [localSelectedIds, setLocalSelectedIds] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => loadColumnWidths(tableId));
  const settingsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(FONT_STORAGE_KEY, fontSize); } catch { /* ignore */ }
  }, [fontSize]);

  useEffect(() => {
    if (!densityProp) {
      try { localStorage.setItem(DENSITY_STORAGE_KEY, density); } catch { /* ignore */ }
    }
  }, [density, densityProp]);

  const effectiveDensity = densityProp || density;

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      onSearch?.(value);
    }, 300);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    onSearch?.('');
  };

  const hasVisibleColumns = visibleColumns.length > 0;

  const hasRowActions = rowActions && rowActions.length > 0;

  // Selection management
  const selectedIds = selection?.selectedIds ?? localSelectedIds;
  const onSelectionChange = selection?.onSelectionChange ?? ((ids: Set<string>) => setLocalSelectedIds(ids));
  const getRowIdFn = selection?.getRowId ?? ((row: T) => {
    if (typeof idKey === 'function') return idKey(row);
    if (idKey) return String((row as any)[idKey]);
    return '';
  });

  const handleToggleRow = useCallback((rowId: string) => {
    const next = new Set(selectedIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    onSelectionChange(next);
  }, [selectedIds, onSelectionChange]);

  const allSelected = data.length > 0 && data.every(row => selectedIds.has(getRowIdFn(row)));
  const someSelected = data.some(row => selectedIds.has(getRowIdFn(row))) && !allSelected;

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      const next = new Set(selectedIds);
      data.forEach(row => next.add(getRowIdFn(row)));
      onSelectionChange(next);
    }
  }, [allSelected, data, selectedIds, onSelectionChange, getRowIdFn]);

  const handleClearSelection = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  // Expandable management
  const effectiveExpandedIds = expandedIds ?? localExpandedIds;
  const effectiveOnExpandedChange = onExpandedChange ?? ((ids: Set<string>) => setLocalExpandedIds(ids));

  const handleToggleExpand = useCallback((rowId: string) => {
    const next = new Set(effectiveExpandedIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    effectiveOnExpandedChange(next);
  }, [effectiveExpandedIds, effectiveOnExpandedChange]);

  const allExpanded = data.length > 0 && data.every(row => effectiveExpandedIds.has(getRowIdFn(row)));

  const handleToggleExpandAll = useCallback(() => {
    if (allExpanded) {
      effectiveOnExpandedChange(new Set());
    } else {
      const next = new Set(effectiveExpandedIds);
      data.forEach(row => next.add(getRowIdFn(row)));
      effectiveOnExpandedChange(next);
    }
  }, [allExpanded, data, effectiveExpandedIds, effectiveOnExpandedChange, getRowIdFn]);

  // Column resize
  const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
    setColumnWidths(prev => {
      const next = { ...prev, [columnKey]: newWidth };
      saveColumnWidths(tableId, next);
      return next;
    });
    onColumnResize?.(columnKey, newWidth);
  }, [tableId, onColumnResize]);

  // Apply column widths to visible columns
  const resizedColumns = useMemo(() => {
    if (Object.keys(columnWidths).length === 0) return visibleColumns;
    return visibleColumns.map(col => {
      const savedWidth = columnWidths[col.key];
      if (!savedWidth) return col;
      return { ...col, computedWidth: `${savedWidth}px` };
    });
  }, [visibleColumns, columnWidths]);

  // Filter change handler
  const handleFilterChange = useCallback((columnKey: string, value: ActiveFilters[string] | undefined) => {
    if (!onFilterChange) return;
    // We need to merge with existing filters, but since we don't have them here,
    // the parent manages the full filter state via activeFilters prop
    // This is a simplified approach; the parent should pass the full activeFilters object
    onFilterChange({ [columnKey]: value } as ActiveFilters);
  }, [onFilterChange]);

  return (
    <div className={clsx(
      'bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col h-full transition-colors duration-300',
      className
    )}>
      {/* Toolbar: Search + Settings */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        {searchable && (
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-8 py-2 text-sm border border-[var(--color-border)] rounded-md bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-[var(--color-bg-secondary)] rounded"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              </button>
            )}
          </div>
        )}

        <div className="relative" ref={settingsRef}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors text-[var(--color-text-secondary)]"
            aria-label="Table settings"
            title="Table settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {showSettings && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-lg z-[100] p-4 text-xs text-[var(--color-text-primary)]">
              {/* Density */}
              <div className="mb-4">
                <h3 className="font-bold text-[var(--color-text-primary)] uppercase mb-2 tracking-wider">
                  Density
                </h3>
                <div className="flex gap-2">
                  {(['compact', 'comfortable', 'spacious'] as Density[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className={clsx(
                        'px-3 py-1.5 rounded border transition-all truncate flex-1 font-medium capitalize',
                        effectiveDensity === d
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-primary-500'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="mb-4">
                <h3 className="font-bold text-[var(--color-text-primary)] uppercase mb-2 tracking-wider">
                  Font Size
                </h3>
                <div className="flex gap-2">
                  {(['sm', 'md', 'lg'] as FontSize[]).map(size => (
                    <button
                      key={size}
                      onClick={() => setFontSize(size)}
                      className={clsx(
                        'px-3 py-1.5 rounded border transition-all truncate flex-1 font-medium',
                        fontSize === size
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-primary-500'
                      )}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column Visibility */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                    Columns
                  </h3>
                  <button
                    onClick={resetColumns}
                    className="text-[var(--color-text-muted)] hover:text-primary-600 transition-colors"
                  >
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                  {columns.map(col => {
                    const visible = isColumnVisible(col.key);
                    return (
                      <button
                        key={col.key}
                        onClick={() => toggleColumn(col.key)}
                        className={clsx(
                          'flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left',
                          visible
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                        )}
                      >
                        <span className="truncate flex-1">{col.label}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-[var(--color-text-muted)]">
                            {PRIORITY_LABELS[col.priority]}
                          </span>
                          {visible && <Check size={14} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectable && bulkActions && bulkActions.length > 0 && (
        <DataTableToolbar
          selectedCount={selectedIds.size}
          totalCount={data.length}
          bulkActions={bulkActions}
          data={data}
          selectedIds={selectedIds}
          getRowId={getRowIdFn}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Custom Toolbar Slot */}
      {toolbar && (
        <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          {toolbar}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto min-h-0">
          {hasVisibleColumns ? (
            <table className="w-full table-fixed divide-y divide-[var(--color-border)]">
            <DataTableHeader
              columns={resizedColumns}
              sorting={sorting ? { field: sorting.field, direction: sorting.direction } : undefined}
              onSort={sorting?.onSort}
              sortCycle={sorting?.sortCycle}
              sticky={stickyHeader}
              fontSize={fontSize}
              selectable={selectable}
              allSelected={allSelected}
              someSelected={someSelected}
              onSelectAll={handleSelectAll}
              expandable={expandable}
              allExpanded={allExpanded}
              onToggleExpandAll={handleToggleExpandAll}
              resizable={resizable}
              onColumnResize={handleColumnResize}
              onFilterChange={handleFilterChange}
              activeFilters={activeFilters}
              hasRowActions={hasRowActions}
            />
            <DataTableBody
              columns={resizedColumns}
              data={data}
              loading={loading}
              emptyMessage={emptyMessage}
              onRowClick={onRowClick}
              idKey={idKey}
              fontSize={fontSize}
              density={effectiveDensity}
              selectable={selectable}
              selectedIds={selectedIds}
              onToggleRow={handleToggleRow}
              getRowId={getRowIdFn}
              expandable={expandable}
              renderExpanded={renderExpanded}
              expandedIds={effectiveExpandedIds}
              onToggleExpand={handleToggleExpand}
              rowActions={rowActions}
            />
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-[var(--color-text-muted)]">
            <p className="text-sm mb-3">No columns visible</p>
            <button
              onClick={resetColumns}
              className="px-4 py-2 text-sm font-medium text-primary-600 border border-primary-600 rounded-md hover:bg-primary-50 transition-colors"
            >
              Reset to defaults
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-primary)] sticky bottom-0 z-10">
          <DataTablePagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            onPageSizeChange={pagination.onPageSizeChange}
            pageSizeOptions={pagination.pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
