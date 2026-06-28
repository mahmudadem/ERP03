import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../../../hooks/useBreakpoint';

interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function DataTablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: DataTablePaginationProps) {
  const { t } = useTranslation('common');
  const isSm = useBreakpoint('sm');

  if (totalPages <= 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | '...')[] = [];
    pages.push(1);

    if (page > 3) pages.push('...');

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) pages.push('...');

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
      <div className="flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        <span>
          {t('dataTable.pagination.showing', 'Showing {{start}}-{{end}} of {{total}}', {
            start: startItem,
            end: endItem,
            total: totalItems,
          })}
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus:ring-1 focus:ring-primary-500 outline-none"
            aria-label={t('dataTable.pagination.rowsPerPage', 'Rows per page')}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {t('dataTable.pagination.pageSizeOption', '{{size}} / page', { size })}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={t('dataTable.pagination.previousPage', 'Previous page')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {isSm ? (
          getPageNumbers().map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-[var(--color-text-muted)]">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={clsx(
                  'min-w-[32px] h-8 px-2 text-sm rounded-md transition-colors',
                  p === page
                    ? 'bg-primary-600 text-white font-medium'
                    : 'hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]'
                )}
              >
                {p}
              </button>
            )
          )
        ) : (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {t('dataTable.pagination.pageOf', 'Page {{page}} of {{totalPages}}', {
              page,
              totalPages,
            })}
          </span>
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-md hover:bg-[var(--color-bg-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={t('dataTable.pagination.nextPage', 'Next page')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
