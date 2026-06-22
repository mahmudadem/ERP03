import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { ChevronRight, ChevronDown, MoreVertical } from 'lucide-react';
import { ResponsiveColumn, RowAction, BadgeVariant, Density } from './types';

interface DataTableBodyProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  idKey?: keyof T | ((row: T) => string);
  fontSize: 'sm' | 'md' | 'lg';
  density?: Density;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (rowId: string) => void;
  getRowId?: (row: T) => string;
  expandable?: boolean;
  renderExpanded?: (row: T) => React.ReactNode;
  expandedIds?: Set<string>;
  onToggleExpand?: (rowId: string) => void;
  rowActions?: RowAction<T>[];
  /** If provided, only rows returning true show the expand toggle */
  isRowExpandable?: (row: T) => boolean;
  /** Custom row class name function */
  getRowClassName?: (row: T) => string;
}

const FONT_SIZE_MAP = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const DENSITY_PADDING: Record<Density, string> = {
  compact: 'px-2 py-1.5',
  comfortable: 'px-3 py-3',
  spacious: 'px-4 py-4',
};

const DENSITY_PADDING_HEADER: Record<Density, string> = {
  compact: 'px-2 py-2',
  comfortable: 'px-3 py-3',
  spacious: 'px-4 py-4',
};

const BADGE_VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

const ACTION_VARIANT_CLASSES: Record<string, string> = {
  default: 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
  primary: 'text-primary-600 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20',
  danger: 'text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20',
  warning: 'text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  success: 'text-green-500 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20',
};

const SKELETON_ROWS = 5;

function getRowId<T>(row: T, idKey: keyof T | ((row: T) => string) | undefined, index: number): string {
  if (typeof idKey === 'function') return idKey(row);
  if (idKey) return String((row as any)[idKey]);
  return `row-${index}`;
}

function getCellValue<T>(row: T, col: ResponsiveColumn<T>): any {
  if (col.accessor) {
    if (typeof col.accessor === 'function') return col.accessor(row);
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
  density = 'comfortable',
  selectable,
  selectedIds,
  onToggleRow,
  getRowId: externalGetRowId,
  expandable,
  renderExpanded,
  expandedIds,
  onToggleExpand,
  rowActions,
  isRowExpandable,
  getRowClassName,
}: DataTableBodyProps<T>) {
  const fontClass = FONT_SIZE_MAP[fontSize];
  const cellPadding = DENSITY_PADDING[density];

  const getRowIdFn = externalGetRowId || ((row: T, idx: number) => getRowId(row, idKey, idx));

  if (loading) {
    return (
      <tbody>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <tr key={`skeleton-${i}`} className="animate-pulse">
            {expandable && <td className="px-2 py-3 w-10" />}
            {selectable && <td className="px-2 py-3 w-10" />}
            {columns.map(col => (
              <td
                key={col.key}
                className={cellPadding}
                style={{ width: col.computedWidth }}
              >
                <div className="h-4 bg-[var(--color-bg-tertiary)] rounded w-3/4" />
              </td>
            ))}
            {rowActions && rowActions.length > 0 && <td className="px-4 py-3 w-24" />}
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
            colSpan={columns.length + (expandable ? 1 : 0) + (selectable ? 1 : 0) + (rowActions?.length ? 1 : 0)}
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
        const rowId = getRowIdFn(row, index);
        const isClickable = !!onRowClick;
        const isSelected = selectedIds?.has(rowId) ?? false;
        const isExpanded = expandedIds?.has(rowId) ?? false;
        const primaryActions = rowActions?.filter(a => a.primary) ?? [];
        const secondaryActions = rowActions?.filter(a => !a.primary) ?? [];
        const canExpand = isRowExpandable ? isRowExpandable(row) : true;

        return (
          <React.Fragment key={rowId}>
            <tr
              className={clsx(
                'transition-colors',
                getRowClassName?.(row),
                !getRowClassName && isSelected && 'bg-primary-50/50 dark:bg-primary-900/10',
                !getRowClassName && isClickable && !selectable && 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/10',
                !getRowClassName && !isSelected && index % 2 === 0 && 'bg-[var(--color-bg-primary)]',
                !getRowClassName && !isSelected && index % 2 !== 0 && 'bg-[var(--color-bg-secondary)]/30'
              )}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button, a, input, select, [role="button"]')) return;
                onRowClick?.(row, index);
              }}
              tabIndex={isClickable && !selectable ? 0 : undefined}
              onKeyDown={e => {
                if (isClickable && !selectable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onRowClick?.(row, index);
                }
              }}
            >
              {expandable && (
                <td className="px-2 py-3 w-10 text-center">
                  {canExpand ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleExpand?.(rowId); }}
                      className="p-0.5 hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                      aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                        : <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                      }
                    </button>
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </td>
              )}

              {selectable && (
                <td className="px-2 py-3 w-10 text-center">
                  <RowCheckbox
                    checked={isSelected}
                    onChange={() => onToggleRow?.(rowId)}
                  />
                </td>
              )}

              {columns.map(col => {
                const alignClass = col.align === 'center'
                  ? 'text-center'
                  : col.align === 'right'
                    ? 'text-right'
                    : 'text-left';

                const value = getCellValue(row, col);
                const stickyClass = col.sticky
                  ? `sticky-${col.sticky} bg-[var(--color-bg-primary)] z-10`
                  : '';

                let cellContent: React.ReactNode;
                if (col.render) {
                  cellContent = col.render(value, row, index);
                } else if (col.badge && value != null) {
                  const variant = col.badge.variantMap[String(value)] ?? 'default';
                  const IconComponent = col.badge.iconMap?.[String(value)];
                  cellContent = (
                    <span className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                      BADGE_VARIANT_CLASSES[variant]
                    )}>
                      {IconComponent && <IconComponent className="w-3 h-3" />}
                      {String(value)}
                    </span>
                  );
                } else {
                  cellContent = value != null ? String(value) : '-';
                }

                return (
                  <td
                    key={col.key}
                    className={clsx(
                      'text-[var(--color-text-primary)]',
                      cellPadding,
                      alignClass,
                      fontClass,
                      col.truncate && 'truncate',
                      stickyClass,
                      col.className
                    )}
                    style={{ width: col.computedWidth }}
                    title={col.truncate && typeof cellContent === 'string' ? cellContent : undefined}
                  >
                    {col.truncate && typeof cellContent === 'string' ? (
                      <span className="block truncate" title={cellContent}>
                        {cellContent}
                      </span>
                    ) : cellContent}
                  </td>
                );
              })}

              {rowActions && rowActions.length > 0 && (
                <td className="px-4 py-3 w-24 text-center">
                  <RowActionsMenu
                    primaryActions={primaryActions}
                    secondaryActions={secondaryActions}
                    row={row}
                  />
                </td>
              )}
            </tr>

            {expandable && isExpanded && renderExpanded && (
              <tr className="bg-[var(--color-bg-secondary)]/50">
                <td colSpan={columns.length + (expandable ? 1 : 0) + (selectable ? 1 : 0) + (rowActions?.length ? 1 : 0)}>
                  <div className="px-4 py-3 ml-8">
                    {renderExpanded(row)}
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}

// ── Row Checkbox ─────────────────────────────────────────────────────

function RowCheckbox({ checked, onChange }: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="w-4 h-4 rounded border flex items-center justify-center transition-colors"
      style={{
        borderColor: checked ? 'var(--color-primary-600, #4f46e5)' : 'var(--color-border)',
        backgroundColor: checked ? 'var(--color-primary-600, #4f46e5)' : 'transparent',
      }}
      aria-label={checked ? 'Deselect row' : 'Select row'}
    >
      {checked && (
        <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3 text-white">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

// ── Row Actions Menu ─────────────────────────────────────────────────

function RowActionsMenu<T>({ primaryActions, secondaryActions, row }: {
  primaryActions: RowAction<T>[];
  secondaryActions: RowAction<T>[];
  row: T;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen(!open);
  };

  const allEnabledActions = secondaryActions.filter(a => a.isEnabled ? a.isEnabled(row) : true);
  const maxPrimary = 2;

  return (
    <div className="relative inline-flex items-center gap-0.5">
      {primaryActions.slice(0, maxPrimary).map(action => {
        const enabled = action.isEnabled ? action.isEnabled(row) : true;
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
            disabled={!enabled}
            className={clsx(
              'p-1.5 rounded transition-colors',
              ACTION_VARIANT_CLASSES[action.variant ?? 'default'],
              !enabled && 'opacity-30 cursor-not-allowed'
            )}
            title={action.tooltip || action.label}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}

      {allEnabledActions.length > 0 && (
        <>
          <button
            ref={buttonRef}
            onClick={handleToggle}
            className="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title="More actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {open && createPortal(
            <div
              ref={menuRef}
              className="fixed w-44 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-lg z-[9999] py-1"
              style={{ top: coords.top, right: coords.right }}
            >
              {allEnabledActions.map(action => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.key}
                    onClick={(e) => { e.stopPropagation(); action.onClick(row); setOpen(false); }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                      ACTION_VARIANT_CLASSES[action.variant ?? 'default']
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{action.label}</span>
                  </button>
                );
              })}
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}
