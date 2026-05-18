import React from 'react';

export type ColumnPriority = 1 | 2 | 3;
export type ColumnAlign = 'left' | 'center' | 'right';
export type FontSize = 'sm' | 'md' | 'lg';

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
}

export interface DataTablePaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export interface DataTableSortingState {
  field: string;
  direction: 'asc' | 'desc';
  onSort: (field: string) => void;
}

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
}

export interface ResponsiveColumn<T = any> extends ColumnDefinition<T> {
  computedWidth: string;
}
