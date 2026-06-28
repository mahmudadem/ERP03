import React from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { BulkAction } from './types';

interface DataTableToolbarProps<T = any> {
  selectedCount: number;
  totalCount: number;
  bulkActions: BulkAction<T>[];
  data: T[];
  selectedIds: Set<string>;
  getRowId: (row: T) => string;
  onClearSelection: () => void;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] border-[var(--color-border)]',
  primary: 'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 border-primary-300 dark:border-primary-700',
  danger: 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-300 dark:border-red-700',
  warning: 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 border-amber-300 dark:border-amber-700',
  success: 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-300 dark:border-green-700',
};

export function DataTableToolbar<T = any>({
  selectedCount,
  totalCount,
  bulkActions,
  data,
  selectedIds,
  getRowId,
  onClearSelection,
}: DataTableToolbarProps<T>) {
  const { t } = useTranslation('common');

  if (selectedCount === 0) return null;

  const selectedRows = data.filter(row => selectedIds.has(getRowId(row)));

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-800">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
          {t('dataTable.selection.selectedCount', '{{selected}} of {{total}} selected', {
            selected: selectedCount,
            total: totalCount,
          })}
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 underline"
        >
          {t('dataTable.selection.clear', 'Clear')}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {bulkActions.map(action => {
          const isDisabled = action.requiresCount ? selectedCount < action.requiresCount : false;
          const Icon = action.icon;
          const variantClass = VARIANT_CLASSES[action.variant ?? 'default'];

          return (
            <button
              key={action.key}
              onClick={() => action.onClick(selectedRows)}
              disabled={isDisabled}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors',
                variantClass,
                isDisabled && 'opacity-40 cursor-not-allowed'
              )}
              title={action.label}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
