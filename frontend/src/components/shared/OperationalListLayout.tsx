import React from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { PageHeader } from '../ui/PageHeader';
import { Card } from '../ui/Card';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { DataTable } from '../ui/DataTable';
import { DataTableProps } from '../ui/DataTable/types';

export interface OperationalListLayoutProps<T> extends Omit<DataTableProps<T>, 'stickyHeader'> {
  title: string;
  subtitle?: string;
  newButtonLabel?: string;
  onNewClick?: () => void;
  onRefresh?: () => void;
  filters?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  summaryWidgets?: React.ReactNode;
  compactHeader?: boolean;
}

export function OperationalListLayout<T = any>({
  title,
  subtitle,
  newButtonLabel,
  onNewClick,
  onRefresh,
  filters,
  hasActiveFilters,
  onClearFilters,
  summaryWidgets,
  compactHeader = false,
  className,
  ...dataTableProps
}: OperationalListLayoutProps<T>) {
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const isWindowsMode = uiMode === 'windows';

  return (
    <div
      className={clsx(
        'w-full h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300',
        isWindowsMode ? 'p-3 space-y-3' : compactHeader ? 'p-6 space-y-3' : 'p-6 space-y-5'
      )}
    >
      {/* Page Header */}
      <div className={clsx('flex-none', compactHeader && '[&>div]:mb-0')}>
        <PageHeader
          title={title}
          subtitle={subtitle}
          action={
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  title={t('actions.refresh', 'Refresh')}
                  disabled={dataTableProps.loading}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-primary-600 dark:hover:text-primary-400 transition-all active:scale-95 disabled:opacity-50 duration-200"
                >
                  <RefreshCw
                    size={16}
                    className={clsx(dataTableProps.loading && 'animate-spin')}
                  />
                </button>
              )}
              {onNewClick && newButtonLabel && (
                <button
                  type="button"
                  onClick={onNewClick}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
                >
                  <Plus size={16} />
                  <span>{newButtonLabel}</span>
                </button>
              )}
            </div>
          }
        />
      </div>

      {/* Summary Widgets Tray */}
      {summaryWidgets && (
        <div className="flex-none w-full">
          {summaryWidgets}
        </div>
      )}

      {/* Filters Panel */}
      {filters && (
        <div className="flex-none w-full">
          <Card padding="none" className="p-2 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-sm relative group">
            {/* Subtle premium accent bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary-500 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="w-full">
              {filters}
            </div>
          </Card>
        </div>
      )}

      {/* Main Table Area */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col w-full">
        <DataTable
          resizable={true}
          {...dataTableProps}
          stickyHeader={true}
          className={clsx(
            'flex-1 min-h-0 overflow-hidden flex flex-col bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800/80 shadow-sm',
            className
          )}
        />
      </div>
    </div>
  );
}
