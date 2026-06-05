/**
 * ClassicLineItemsTable.tsx
 *
 * Shared line-items table for invoice / voucher / quote forms. Visual style
 * matches the "Classic" table in GenericVoucherRenderer (sticky header,
 * borderless inline selectors, hover row, # column, Action column). Driven by
 * a generic column config so each form (SI, PI, SO, SR, PR, GVR) declares its
 * own fields without rebuilding the layout.
 *
 * Cell-native selectors: caller passes their existing selector inside a
 * `custom` column and the table provides cell-shaped padding (h-9 + p-0.5);
 * selectors should be rendered with `noBorder` so they blend into the cell.
 *
 * Not aiming for full GVR feature parity yet (no column resize, no row
 * context menu, no row highlighting). Those can be folded in later as
 * consumers need them.
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

export interface ColumnDef<T> {
  /** Stable column id, used as the React key. */
  id: string;
  /** Column header text. */
  label: string;
  /** Optional fixed width (e.g. `"120px"`, `"15%"`). Defaults to auto. */
  width?: string;
  /** Cell alignment. Defaults: text/select/custom → left, number/computed → right. */
  align?: 'left' | 'right' | 'center';
  /** Render strategy for this column. */
  kind: 'text' | 'number' | 'select' | 'computed' | 'custom';

  // --- For kind: 'text' | 'number' ---
  /** Read the row's value for this cell. Required for text/number/select. */
  accessor?: (row: T) => any;
  /** Build the patch to apply when the user edits this cell. */
  setter?: (value: any) => Partial<T>;
  /** Placeholder for input fields. */
  placeholder?: string;
  /** For kind: 'number' — number of decimals (default 2). */
  decimals?: number;

  // --- For kind: 'select' ---
  /** Options for native select dropdowns. */
  options?: Array<{ value: string; label: string }>;

  // --- For kind: 'computed' ---
  /** Derive a display value from the row + its index. Read-only. */
  compute?: (row: T, index: number) => string | number;
  /** Format the computed value. Defaults: numbers → toFixed(decimals ?? 2). */
  formatter?: (value: any) => string;

  // --- For kind: 'custom' ---
  /** Render anything inside the cell (typically a selector with noBorder). */
  render?: (row: T, index: number, onChange: (patch: Partial<T>) => void) => React.ReactNode;
}

export interface ClassicLineItemsTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  /** Called when the user edits a cell. */
  onRowChange: (rowIndex: number, patch: Partial<T>) => void;
  /** Optional row removal. When omitted, no trash column is rendered. */
  onRowRemove?: (rowIndex: number) => void;
  /** Optional add-row footer button. When omitted, no add button is rendered. */
  onRowAdd?: () => void;
  /** Label for the add button (defaults to "Add Item"). */
  addLabel?: string;
  /** Text shown when `rows` is empty and `onRowAdd` is provided. */
  emptyMessage?: string;
  /** Globally disables all inputs and the add/remove buttons. */
  disabled?: boolean;
  /** Show the leading # column with the row index. Defaults to true. */
  showRowNumbers?: boolean;
  /** Minimum number of rows required to keep at least one (delete disabled below this). */
  minRows?: number;
  /** Optional extra class on the outer wrapper. */
  className?: string;
}

const alignClass = (align: ColumnDef<any>['align'], kind: ColumnDef<any>['kind']): string => {
  const effective = align ?? (kind === 'number' || kind === 'computed' ? 'right' : 'left');
  if (effective === 'right') return 'text-right';
  if (effective === 'center') return 'text-center';
  return 'text-left';
};

const formatNumber = (value: any, decimals: number): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toFixed(decimals);
};

/**
 * Generic Classic line-items table.
 */
export function ClassicLineItemsTable<T>(props: ClassicLineItemsTableProps<T>) {
  const {
    columns,
    rows,
    onRowChange,
    onRowRemove,
    onRowAdd,
    addLabel = 'Add Item',
    emptyMessage = 'No line items yet.',
    disabled = false,
    showRowNumbers = true,
    minRows = 1,
    className = '',
  } = props;

  const showRemove = !!onRowRemove;
  const rowChangeFor = (rowIndex: number) => (patch: Partial<T>) => onRowChange(rowIndex, patch);

  const renderCell = (row: T, rowIndex: number, col: ColumnDef<T>): React.ReactNode => {
    const cellOnChange = rowChangeFor(rowIndex);

    switch (col.kind) {
      case 'custom':
        return col.render ? col.render(row, rowIndex, cellOnChange) : null;

      case 'computed': {
        const raw = col.compute ? col.compute(row, rowIndex) : '';
        const formatted = col.formatter
          ? col.formatter(raw)
          : typeof raw === 'number'
            ? formatNumber(raw, col.decimals ?? 2)
            : String(raw ?? '');
        return (
          <div className="px-3 py-2 h-9 flex items-center justify-end text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-50/40 dark:bg-slate-900/30">
            {formatted}
          </div>
        );
      }

      case 'text': {
        const value = col.accessor ? col.accessor(row) : '';
        return (
          <input
            type="text"
            value={value ?? ''}
            placeholder={col.placeholder}
            disabled={disabled}
            onChange={(e) => col.setter && cellOnChange(col.setter(e.target.value))}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none text-xs text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignClass(col.align, col.kind)}`}
          />
        );
      }

      case 'number': {
        const value = col.accessor ? col.accessor(row) : '';
        return (
          <input
            type="number"
            value={value ?? ''}
            placeholder={col.placeholder}
            disabled={disabled}
            step="any"
            onChange={(e) => {
              if (!col.setter) return;
              const raw = e.target.value;
              const num = raw === '' ? 0 : Number(raw);
              cellOnChange(col.setter(num));
            }}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignClass(col.align, col.kind)}`}
          />
        );
      }

      case 'select': {
        const value = col.accessor ? col.accessor(row) : '';
        return (
          <select
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => col.setter && cellOnChange(col.setter(e.target.value))}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none text-xs text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 appearance-none cursor-pointer ${alignClass(col.align, col.kind)}`}
          >
            {(col.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 rounded overflow-hidden shadow-sm bg-white dark:bg-slate-950 ${className}`}
    >
      <div className="max-h-[480px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[600px] border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
            <tr className="border-b-2 border-slate-200 dark:border-slate-800">
              {showRowNumbers && (
                <th className="p-2 text-center w-10 text-[11px] font-bold text-slate-700 dark:text-slate-200 border-r border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`p-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide border-r border-slate-200 dark:border-slate-800 ${alignClass(col.align, col.kind)}`}
                  style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
              {showRemove && <th className="p-2 w-10" aria-label="Actions" />}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={(showRowNumbers ? 1 : 0) + columns.length + (showRemove ? 1 : 0)}
                  className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors duration-100 border-b border-slate-100 dark:border-slate-800"
                >
                  {showRowNumbers && (
                    <td className="p-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20">
                      {rowIndex + 1}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className="p-0 border-r border-slate-100 dark:border-slate-800 align-middle"
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                    >
                      <div className="p-0.5">{renderCell(row, rowIndex, col)}</div>
                    </td>
                  ))}
                  {showRemove && (
                    <td className="p-1 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => onRowRemove?.(rowIndex)}
                        disabled={disabled || rows.length <= minRows}
                        className="inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                        aria-label={`Remove row ${rowIndex + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onRowAdd && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 flex justify-end">
          <button
            type="button"
            onClick={onRowAdd}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3 w-3" />
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export default ClassicLineItemsTable;
