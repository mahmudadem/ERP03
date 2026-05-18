import React from 'react';

export type ColumnPriority = 1 | 2 | 3;
export type ColumnAlign = 'left' | 'center' | 'right';
export type FontSize = 'sm' | 'md' | 'lg';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type SortDirection = 'asc' | 'desc' | null;
export type SortCycle = 'toggle' | 'cycle';

// ── Column Filter Types ──────────────────────────────────────────────

export type FilterType = 'text' | 'date-range' | 'multi-select' | 'single-select' | 'number-range';

export interface FilterOption {
  value: string;
  label: string;
}

export interface ColumnFilterConfig {
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

export interface ActiveFilters {
  [columnKey: string]: string | string[] | { from?: string; to?: string } | { min?: number; max?: number };
}

// ── Row Action Types ─────────────────────────────────────────────────

export interface RowAction<T = any> {
  key: string;
  label: string;
  icon: React.ElementType;
  onClick: (row: T) => void;
  variant?: 'default' | 'primary' | 'danger' | 'warning' | 'success';
  isEnabled?: (row: T) => boolean;
  tooltip?: string;
  primary?: boolean; // if true, shown as inline icon; if false, goes in dropdown
}

// ── Bulk Action Types ────────────────────────────────────────────────

export interface BulkAction<T = any> {
  key: string;
  label: string;
  icon: React.ElementType;
  onClick: (selectedRows: T[]) => void;
  variant?: 'default' | 'primary' | 'danger' | 'warning' | 'success';
  requiresCount?: number; // minimum selected rows to enable
}

// ── Badge Config ─────────────────────────────────────────────────────

export type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface BadgeConfig {
  variantMap: Record<string, BadgeVariant>;
  iconMap?: Record<string, React.ElementType>;
}

// ── Column Definition ────────────────────────────────────────────────

export interface ColumnDefinition<T = any> {
  key: string;
  label: string;
  width: string;
  priority: ColumnPriority;
  align?: ColumnAlign;
  sortable?: boolean;
  truncate?: boolean;
  accessor?: keyof T | ((row: T) => any);
  render?: (value: any, row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  filter?: ColumnFilterConfig;
  badge?: BadgeConfig;
  sticky?: 'left' | 'right';
  resizable?: boolean;
}

// ── Pagination State ─────────────────────────────────────────────────

export interface DataTablePaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

// ── Sorting State ────────────────────────────────────────────────────

export interface DataTableSortingState {
  field: string;
  direction: SortDirection;
  onSort: (field: string) => void;
  sortCycle?: SortCycle;
}

// ── Selection State ──────────────────────────────────────────────────

export interface DataTableSelectionState<T = any> {
  selectedIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  getRowId: (row: T) => string;
}

// ── Main Props ───────────────────────────────────────────────────────

export interface DataTableProps<T = any> {
  columns: ColumnDefinition<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  pagination?: DataTablePaginationState;
  sorting?: DataTableSortingState;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  stickyHeader?: boolean;
  className?: string;
  idKey?: keyof T | ((row: T) => string);

  // Selection
  selectable?: boolean;
  selection?: DataTableSelectionState<T>;
  bulkActions?: BulkAction<T>[];

  // Row actions
  rowActions?: RowAction<T>[];

  // Filters
  onFilterChange?: (filters: ActiveFilters) => void;
  activeFilters?: ActiveFilters;

  // Expandable rows
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  expandedIds?: Set<string>;
  onExpandedChange?: (expandedIds: Set<string>) => void;
  /** If provided, only rows returning true show the expand toggle */
  isRowExpandable?: (row: T) => boolean;
  /** Custom row class name function */
  getRowClassName?: (row: T) => string;

  // Density
  density?: Density;

  // Toolbar slot
  toolbar?: React.ReactNode;

  // Column resizing
  resizable?: boolean;
  onColumnResize?: (columnKey: string, newWidth: number) => void;
}

// ── Responsive Column ────────────────────────────────────────────────

export interface ResponsiveColumn<T = any> extends ColumnDefinition<T> {
  computedWidth: string;
}
