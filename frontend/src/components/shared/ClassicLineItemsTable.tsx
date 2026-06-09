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
 * Includes the shared GVR-classic context behavior used by native document
 * pages: row copy/paste/delete/insert/highlight, table copy/paste/clean,
 * export/import, local table skin preferences, and optional 25-line edit mode.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clipboard, Copy, Download, Eraser, Palette, Plus, Settings2, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  /** Stable local-storage key suffix. Use module/document name, e.g. "sales.invoice.lines". */
  tableId?: string;
  /** Optional section title rendered in the shared SI/PI-style table header. */
  title?: string;
  /** Optional compact action area rendered next to the title. */
  headerAction?: React.ReactNode;
  columns: ColumnDef<T>[];
  rows: T[];
  /** Called when the user edits a cell. */
  onRowChange: (rowIndex: number, patch: Partial<T>) => void;
  /** Optional row removal. When omitted, no trash column is rendered. */
  onRowRemove?: (rowIndex: number) => void;
  /** Optional full-row replacement. Enables paste/import/clean/minimum edit rows. */
  onRowsChange?: (rows: T[]) => void;
  /** Optional empty-row factory. Enables insert/clean/minimum edit rows. */
  createEmptyRow?: () => T;
  /** Optional filled-row predicate. Enables view-mode empty row hiding and auto-append. */
  isRowFilled?: (row: T) => boolean;
  /** Optional add-row footer button. When omitted, no add button is rendered. */
  onRowAdd?: () => void;
  /** Label for the add button (defaults to "Add Item"). */
  addLabel?: string;
  /** Text shown when `rows` is empty and `onRowAdd` is provided. */
  emptyMessage?: string;
  /** Globally disables all inputs and the add/remove buttons. */
  disabled?: boolean;
  /** In disabled/view mode, hide empty rows when isRowFilled is provided. Defaults to true. */
  viewModeShowsFilledOnly?: boolean;
  /** Minimum working rows shown in edit mode when createEmptyRow + onRowsChange are supplied. */
  minEditRows?: number;
  /** Auto-add one line when the final edit row becomes filled. Defaults to true. */
  enableAutoAppend?: boolean;
  /** Show the leading # column with the row index. Defaults to true. */
  showRowNumbers?: boolean;
  /** Minimum number of rows required to keep at least one (delete disabled below this). */
  minRows?: number;
  /** Optional extra class on the outer wrapper. */
  className?: string;
  /** Optional scroll cap for the table body. Defaults to the current invoice cap. */
  maxBodyHeight?: string;
  /** Optional table min width. Defaults to 600px. */
  minTableWidth?: string;
}

type TableSkin = 'classic' | 'web';
type AlternatingRows = 'none' | 'soft' | 'strong';
type TableTextSize = 'compact' | 'normal' | 'large';
type NumberFont = 'mono' | 'tabular' | 'sans';

type TablePreferences = {
  skin: TableSkin;
  alternatingRows: AlternatingRows;
  textSize: TableTextSize;
  numberFont: NumberFont;
};

const defaultPreferences: TablePreferences = {
  skin: 'classic',
  alternatingRows: 'soft',
  textSize: 'compact',
  numberFont: 'mono',
};

type ContextMenuState =
  | { type: 'row'; x: number; y: number; rowIndex: number }
  | { type: 'table'; x: number; y: number };

type ResizeState = {
  columnId: string;
  startX: number;
  startWidth: number;
};

const alignClass = (align: ColumnDef<any>['align']): string => {
  const effective = align ?? 'center';
  if (effective === 'right') return 'text-right';
  if (effective === 'left') return 'text-left';
  return 'text-center';
};

const formatNumber = (value: any, decimals: number): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toFixed(decimals);
};

const safeReadPreferences = (storageKey: string): TablePreferences => {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? { ...defaultPreferences, ...JSON.parse(raw) } : defaultPreferences;
  } catch {
    return defaultPreferences;
  }
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const parseCsvLine = (line: string): string[] => {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
};

const textSizeClasses: Record<TableTextSize, string> = {
  compact: 'text-xs',
  normal: 'text-sm',
  large: 'text-[15px]',
};

const numberFontClasses: Record<NumberFont, string> = {
  mono: 'font-mono',
  tabular: 'font-sans tabular-nums',
  sans: 'font-sans',
};

const parseColumnWidth = (width: string | undefined): number => {
  if (!width) return 140;
  const parsed = Number.parseInt(width, 10);
  return Number.isFinite(parsed) ? parsed : 140;
};

/**
 * Generic Classic line-items table.
 */
export function ClassicLineItemsTable<T>(props: ClassicLineItemsTableProps<T>) {
  const { t } = useTranslation('common');
  const {
    tableId = 'default',
    columns,
    rows,
    onRowChange,
    onRowRemove,
    onRowsChange,
    createEmptyRow,
    isRowFilled,
    onRowAdd,
    addLabel = t('lineItemsTable.addItem', 'Add Item'),
    emptyMessage = t('lineItemsTable.empty', 'No line items yet.'),
    disabled = false,
    viewModeShowsFilledOnly = true,
    minEditRows = 25,
    enableAutoAppend = true,
    showRowNumbers = true,
    minRows = 1,
    className = '',
    title,
    headerAction,
    maxBodyHeight = '480px',
    minTableWidth = '600px',
  } = props;

  const showRemove = !!onRowRemove;
  const storageKey = `erp03.lineItemsTable.${tableId}.preferences`;
  const highlightStorageKey = `erp03.lineItemsTable.${tableId}.highlights`;
  const widthStorageKey = `erp03.lineItemsTable.${tableId}.columnWidths`;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [preferences, setPreferences] = useState<TablePreferences>(() => safeReadPreferences(storageKey));
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(window.localStorage.getItem(widthStorageKey) || '{}');
    } catch {
      return {};
    }
  });
  const [resizing, setResizing] = useState<ResizeState | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(window.localStorage.getItem(highlightStorageKey) || '[]'));
    } catch {
      return new Set();
    }
  });

  const rowIsFilled = (row: T): boolean => {
    if (isRowFilled) return isRowFilled(row);
    return Object.values(row as Record<string, unknown>).some((value) => {
      if (typeof value === 'number') return value !== 0;
      if (typeof value === 'string') return value.trim() !== '';
      return value !== null && value !== undefined && value !== false;
    });
  };

  const visibleEntries = useMemo(() => {
    const entries = rows.map((row, rowIndex) => ({ row, rowIndex }));
    if (disabled && viewModeShowsFilledOnly) {
      return entries.filter(({ row }) => rowIsFilled(row));
    }
    return entries;
  }, [disabled, rows, viewModeShowsFilledOnly, isRowFilled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences, storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(highlightStorageKey, JSON.stringify(Array.from(highlightedRows)));
  }, [highlightStorageKey, highlightedRows]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(widthStorageKey, JSON.stringify(columnWidths));
  }, [columnWidths, widthStorageKey]);

  useEffect(() => {
    if (!resizing || typeof window === 'undefined') return;
    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.max(72, resizing.startWidth + event.clientX - resizing.startX);
      setColumnWidths((current) => ({ ...current, [resizing.columnId]: nextWidth }));
    };
    const onMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing]);

  useEffect(() => {
    if (disabled || !createEmptyRow || !onRowsChange || rows.length >= minEditRows) return;
    const missing = minEditRows - rows.length;
    onRowsChange([...rows, ...Array.from({ length: missing }, createEmptyRow)]);
  }, [createEmptyRow, disabled, minEditRows, onRowsChange, rows]);

  useEffect(() => {
    if (disabled || !enableAutoAppend || !rows.length || !rowIsFilled(rows[rows.length - 1])) return;
    if (createEmptyRow && onRowsChange) {
      onRowsChange([...rows, createEmptyRow()]);
      return;
    }
    onRowAdd?.();
  }, [createEmptyRow, disabled, enableAutoAppend, onRowAdd, onRowsChange, rows, isRowFilled]);

  const rowChangeFor = (rowIndex: number) => (patch: Partial<T>) => onRowChange(rowIndex, patch);
  const getColumnWidth = (column: ColumnDef<T>) => columnWidths[column.id] || parseColumnWidth(column.width);

  const closeContextMenu = () => setContextMenu(null);

  const updateRows = (nextRows: T[]) => {
    onRowsChange?.(nextRows);
  };

  const copyRow = async (rowIndex: number) => {
    const row = rows[rowIndex];
    if (!row) return;
    await navigator.clipboard?.writeText(JSON.stringify(row, null, 2));
    toast.success(t('lineItemsTable.toast.rowCopied', 'Row copied'));
    closeContextMenu();
  };

  const pasteRow = async (rowIndex: number) => {
    if (disabled) return;
    try {
      const text = await navigator.clipboard?.readText();
      const parsed = JSON.parse(text || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid row');
      onRowChange(rowIndex, parsed as Partial<T>);
      toast.success(t('lineItemsTable.toast.rowPasted', 'Row pasted'));
    } catch {
      toast.error(t('lineItemsTable.toast.invalidRow', 'Clipboard does not contain a valid row'));
    }
    closeContextMenu();
  };

  const insertRow = (rowIndex: number) => {
    if (disabled || !createEmptyRow || !onRowsChange) return;
    const nextRows = [...rows.slice(0, rowIndex + 1), createEmptyRow(), ...rows.slice(rowIndex + 1)];
    updateRows(nextRows);
    toast.success(t('lineItemsTable.toast.rowInserted', 'Row inserted'));
    closeContextMenu();
  };

  const deleteRow = (rowIndex: number) => {
    if (disabled || !onRowRemove || rows.length <= minRows) return;
    onRowRemove(rowIndex);
    toast.success(t('lineItemsTable.toast.rowDeleted', 'Row deleted'));
    closeContextMenu();
  };

  const toggleHighlight = (rowIndex: number) => {
    setHighlightedRows((current) => {
      const next = new Set(current);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
    closeContextMenu();
  };

  const copyTable = async () => {
    await navigator.clipboard?.writeText(JSON.stringify(rows.filter(rowIsFilled), null, 2));
    toast.success(t('lineItemsTable.toast.tableCopied', 'Table copied'));
    closeContextMenu();
  };

  const pasteTable = async () => {
    if (disabled || !onRowsChange) return;
    try {
      const text = await navigator.clipboard?.readText();
      const parsed = JSON.parse(text || '[]');
      if (!Array.isArray(parsed)) throw new Error('Invalid table');
      updateRows(parsed as T[]);
      toast.success(t('lineItemsTable.toast.tablePasted', 'Table pasted'));
    } catch {
      toast.error(t('lineItemsTable.toast.invalidTable', 'Clipboard does not contain a valid table'));
    }
    closeContextMenu();
  };

  const cleanTable = () => {
    if (disabled || !createEmptyRow || !onRowsChange) return;
    updateRows(Array.from({ length: minEditRows }, createEmptyRow));
    setHighlightedRows(new Set());
    toast.success(t('lineItemsTable.toast.tableCleaned', 'Table cleaned'));
    closeContextMenu();
  };

  const exportCsv = () => {
    const headers = columns.map((column) => column.label);
    const body = rows.filter(rowIsFilled).map((row, rowIndex) =>
      columns.map((column) => {
        if (column.kind === 'computed') {
          const value = column.compute ? column.compute(row, rowIndex) : '';
          return csvEscape(column.formatter ? column.formatter(value) : value);
        }
        return csvEscape(column.accessor ? column.accessor(row) : '');
      }).join(','),
    );
    const blob = new Blob([[headers.map(csvEscape).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableId.replace(/[^a-z0-9-_]+/gi, '-') || 'line-items'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('lineItemsTable.toast.tableExported', 'Table exported'));
    closeContextMenu();
  };

  const importRows = async (file: File) => {
    if (disabled || !onRowsChange) return;
    const text = await file.text();
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('Invalid JSON table');
        updateRows(parsed as T[]);
      } else {
        const lines = text.split(/\r?\n/).filter(Boolean);
        const [, ...dataLines] = lines;
        const imported = dataLines.map((line) => {
          const cells = parseCsvLine(line);
          return columns.reduce<Record<string, unknown>>((row, column, index) => {
            row[column.id] = cells[index] ?? '';
            return row;
          }, {}) as T;
        });
        updateRows(imported);
      }
      toast.success(t('lineItemsTable.toast.tableImported', 'Table imported'));
    } catch {
      toast.error(t('lineItemsTable.toast.importFailed', 'Could not import table'));
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
      closeContextMenu();
    }
  };

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
            placeholder=""
            disabled={disabled}
            onChange={(e) => col.setter && cellOnChange(col.setter(e.target.value))}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none ${textSizeClasses[preferences.textSize]} text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignClass(col.align)}`}
          />
        );
      }

      case 'number': {
        const value = col.accessor ? col.accessor(row) : '';
        return (
          <input
            type="number"
            value={value ?? ''}
            placeholder=""
            disabled={disabled}
            step="any"
            onChange={(e) => {
              if (!col.setter) return;
              const raw = e.target.value;
              const num = raw === '' ? 0 : Number(raw);
              cellOnChange(col.setter(num));
            }}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none ${textSizeClasses[preferences.textSize]} ${numberFontClasses[preferences.numberFont]} text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignClass(col.align)}`}
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
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none ${textSizeClasses[preferences.textSize]} ${value ? 'text-slate-900 dark:text-slate-100' : 'text-transparent'} focus:bg-blue-50/40 dark:focus:bg-blue-950/20 appearance-none cursor-pointer ${alignClass(col.align)}`}
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

  const menuButtonClass = 'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800';
  const dangerMenuButtonClass = 'flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30';
  const canEditRows = !disabled;
  const canReplaceRows = canEditRows && !!onRowsChange;
  const canCreateRows = canReplaceRows && !!createEmptyRow;

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-[90]"
          onClick={closeContextMenu}
          onContextMenu={(event) => {
            event.preventDefault();
            closeContextMenu();
          }}
        />
        <div
          className="fixed z-[91] w-52 rounded-lg border border-slate-200 bg-white py-1.5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'row' ? (
            <>
              <button type="button" onClick={() => copyRow(contextMenu.rowIndex)} className={menuButtonClass}>
                <Copy className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.copy', 'Copy')}
              </button>
              <button type="button" onClick={() => pasteRow(contextMenu.rowIndex)} disabled={!canEditRows} className={menuButtonClass}>
                <Clipboard className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.paste', 'Paste')}
              </button>
              <button type="button" onClick={() => insertRow(contextMenu.rowIndex)} disabled={!canCreateRows} className={menuButtonClass}>
                <Plus className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.insertRow', 'Insert row')}
              </button>
              <button type="button" onClick={() => toggleHighlight(contextMenu.rowIndex)} className={menuButtonClass}>
                <Palette className="h-3.5 w-3.5" /> {highlightedRows.has(contextMenu.rowIndex) ? t('lineItemsTable.menu.removeHighlight', 'Remove highlight') : t('lineItemsTable.menu.highlight', 'Highlight')}
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button type="button" onClick={() => deleteRow(contextMenu.rowIndex)} disabled={!canEditRows || !onRowRemove} className={dangerMenuButtonClass}>
                <Trash2 className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.delete', 'Delete')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={copyTable} className={menuButtonClass}>
                <Copy className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.copy', 'Copy')}
              </button>
              <button type="button" onClick={pasteTable} disabled={!canReplaceRows} className={menuButtonClass}>
                <Clipboard className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.paste', 'Paste')}
              </button>
              <button type="button" onClick={cleanTable} disabled={!canCreateRows} className={menuButtonClass}>
                <Eraser className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.clean', 'Clean')}
              </button>
              <button type="button" onClick={exportCsv} className={menuButtonClass}>
                <Download className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.export', 'Export')}
              </button>
              <button type="button" onClick={() => importInputRef.current?.click()} disabled={!canReplaceRows} className={menuButtonClass}>
                <Upload className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.import', 'Import')}
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button type="button" onClick={() => { setShowPreferences(true); closeContextMenu(); }} className={menuButtonClass}>
                <Settings2 className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.uiSelector', 'UI selector')}
              </button>
            </>
          )}
        </div>
      </>
    );
  };

  const renderPreferencesModal = () => {
    if (!showPreferences) return null;
    const setPreference = <K extends keyof TablePreferences>(key: K, value: TablePreferences[K]) =>
      setPreferences((current) => ({ ...current, [key]: value }));

    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/40 p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-900 dark:text-slate-100">{t('lineItemsTable.preferences.title', 'Table UI selector')}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t('lineItemsTable.preferences.subtitle', 'Saved locally for this user and this table.')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPreferences(false)}
              className="rounded border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('lineItemsTable.preferences.done', 'Done')}
            </button>
          </div>
          <div className="grid gap-4 p-4 text-xs">
            <PreferenceGroup label={t('lineItemsTable.preferences.layout', 'Layout')}>
              <PreferenceButton active={preferences.skin === 'classic'} onClick={() => setPreference('skin', 'classic')} label={t('lineItemsTable.preferences.classic', 'Classic')} />
              <PreferenceButton active={preferences.skin === 'web'} onClick={() => setPreference('skin', 'web')} label={t('lineItemsTable.preferences.web', 'Web')} />
            </PreferenceGroup>
            <PreferenceGroup label={t('lineItemsTable.preferences.rowColoring', 'Row coloring')}>
              <PreferenceButton active={preferences.alternatingRows === 'none'} onClick={() => setPreference('alternatingRows', 'none')} label={t('lineItemsTable.preferences.none', 'None')} />
              <PreferenceButton active={preferences.alternatingRows === 'soft'} onClick={() => setPreference('alternatingRows', 'soft')} label={t('lineItemsTable.preferences.soft', 'Soft')} />
              <PreferenceButton active={preferences.alternatingRows === 'strong'} onClick={() => setPreference('alternatingRows', 'strong')} label={t('lineItemsTable.preferences.strong', 'Strong')} />
            </PreferenceGroup>
            <PreferenceGroup label={t('lineItemsTable.preferences.textSize', 'Text size')}>
              <PreferenceButton active={preferences.textSize === 'compact'} onClick={() => setPreference('textSize', 'compact')} label={t('lineItemsTable.preferences.compact', 'Compact')} />
              <PreferenceButton active={preferences.textSize === 'normal'} onClick={() => setPreference('textSize', 'normal')} label={t('lineItemsTable.preferences.normal', 'Normal')} />
              <PreferenceButton active={preferences.textSize === 'large'} onClick={() => setPreference('textSize', 'large')} label={t('lineItemsTable.preferences.large', 'Large')} />
            </PreferenceGroup>
            <PreferenceGroup label={t('lineItemsTable.preferences.numbersFont', 'Numbers font')}>
              <PreferenceButton active={preferences.numberFont === 'mono'} onClick={() => setPreference('numberFont', 'mono')} label={t('lineItemsTable.preferences.mono', 'Mono')} />
              <PreferenceButton active={preferences.numberFont === 'tabular'} onClick={() => setPreference('numberFont', 'tabular')} label={t('lineItemsTable.preferences.tabular', 'Tabular')} />
              <PreferenceButton active={preferences.numberFont === 'sans'} onClick={() => setPreference('numberFont', 'sans')} label={t('lineItemsTable.preferences.sans', 'Sans')} />
            </PreferenceGroup>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`border border-slate-200 dark:border-slate-800 rounded overflow-hidden shadow-sm bg-white dark:bg-slate-950 ${preferences.skin === 'web' ? 'rounded-md' : ''} ${className}`}
    >
      <input
        ref={importInputRef}
        type="file"
        accept=".json,.csv,text/csv,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importRows(file);
        }}
      />
      {(title || headerAction) && (
        <div className="flex h-9 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-3 dark:border-slate-800 dark:bg-slate-900/60">
          {title ? (
            <h2 className="truncate text-[11px] font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
              {title}
            </h2>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            {headerAction}
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('lineItemsTable.preferences.title', 'Table UI selector')}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <div
        className="overflow-y-auto overflow-x-auto [&_input::placeholder]:text-transparent [&_input::placeholder]:opacity-0"
        style={{ maxHeight: maxBodyHeight }}
      >
        <table className="w-full text-sm border-collapse" style={{ minWidth: minTableWidth }}>
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 z-10">
            <tr className="border-b-2 border-slate-200 dark:border-slate-800">
              {showRowNumbers && (
                <th
                  className="w-10 cursor-context-menu border-r border-slate-200 bg-slate-100/50 p-2 text-center text-[11px] font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/30 dark:text-slate-200"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ type: 'table', x: event.clientX, y: event.clientY });
                  }}
                  onClick={(event) => {
                    if (event.detail === 1) setContextMenu({ type: 'table', x: event.clientX, y: event.clientY });
                  }}
                  title={t('lineItemsTable.menu.tableActions', 'Table actions')}
                >
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`relative p-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide border-r border-slate-200 dark:border-slate-800 ${alignClass(col.align)}`}
                  style={{ width: `${getColumnWidth(col)}px`, minWidth: `${getColumnWidth(col)}px` }}
                >
                  {col.label}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-blue-300/70"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setResizing({
                        columnId: col.id,
                        startX: event.clientX,
                        startWidth: getColumnWidth(col),
                      });
                    }}
                  />
                </th>
              ))}
              {showRemove && <th className="p-2 w-10" aria-label="Actions" />}
            </tr>
          </thead>

          <tbody>
            {visibleEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={(showRowNumbers ? 1 : 0) + columns.length + (showRemove ? 1 : 0)}
                  className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleEntries.map(({ row, rowIndex }, displayIndex) => {
                const isHighlighted = highlightedRows.has(rowIndex);
                const alternatingClass =
                  preferences.alternatingRows === 'none'
                    ? ''
                    : preferences.alternatingRows === 'strong' && displayIndex % 2 === 1
                      ? 'bg-slate-100/70 dark:bg-slate-900/70'
                      : preferences.alternatingRows === 'soft' && displayIndex % 2 === 1
                        ? 'bg-slate-50/60 dark:bg-slate-900/35'
                        : '';
                return (
                <tr
                  key={rowIndex}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ type: 'row', x: event.clientX, y: event.clientY, rowIndex });
                  }}
                  className={`${alternatingClass} ${isHighlighted ? 'bg-amber-100/80 dark:bg-amber-950/30' : ''} hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors duration-100 border-b border-slate-100 dark:border-slate-800`}
                >
                  {showRowNumbers && (
                    <td className="p-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20">
                      {displayIndex + 1}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className="p-0 border-r border-slate-100 dark:border-slate-800 align-middle"
                      style={{ width: `${getColumnWidth(col)}px`, minWidth: `${getColumnWidth(col)}px` }}
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
              );
              })
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
      {renderContextMenu()}
      {renderPreferencesModal()}
    </div>
  );
}

function PreferenceGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
        {children}
      </div>
    </div>
  );
}

function PreferenceButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
        active
          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900'
          : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

export default ClassicLineItemsTable;
