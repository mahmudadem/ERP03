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
import { ArrowDown, ArrowUp, Check, Clipboard, Copy, Download, Eraser, MoreVertical, Palette, Plus, Settings2, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

/**
 * A context-menu item rendered when the user right-clicks either a column
 * header (e.g. "Unit Price") or a single cell in a marked column.
 *
 * `key` is required so React can reconcile the list when callers re-render
 * with a different override state. `onSelect` receives the row index for
 * cell-level menus and `undefined` for column-header menus. `disabled`
 * (optional) is checked by the table — the button is rendered greyed-out
 * and click is suppressed.
 */
export interface ColumnContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onSelect: (rowIndex: number | undefined) => void;
  disabled?: boolean;
  /** Optional danger styling for destructive actions (red). */
  danger?: boolean;
  /** Optional divider rendered above this item. */
  dividerBefore?: boolean;
}

export interface ColumnDef<T> {
  /** Stable column id, used as the React key. */
  id: string;
  /** Column header text. */
  label: string;
  /**
   * Optional extra element rendered inline next to the header label
   * (e.g. a tiny "Override" badge). Kept simple so callers do not need
   * to reach for a render function for the common case.
   */
  labelExtras?: React.ReactNode;
  /**
   * Optional title (tooltip) for the column header. Overrides the default
   * "Right-click for column actions" tooltip.
   */
  labelTitle?: string;
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

  // --- For kind: 'computed' (optional) ---
  /**
   * If provided, the computed cell becomes editable. When the user commits a
   * new value, the returned patch is merged into the row — typically to
   * back-solve a source field (e.g. unit price from line total).
   */
  solveFromTotal?: (value: number, row: T, index: number) => Partial<T>;
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
  /**
   * Stable React key for a row. STRONGLY recommended when rows contain stateful
   * inputs (item/uom/tax pickers, numeric cells): without it rows are keyed by
   * array index, so when the rows array shifts (auto-append, minimum-row
   * padding, deletes) React reuses a stateful input instance across two
   * different data rows. A picker bound to a filled row then leaks its selected
   * item onto the empty row it gets reused for, producing "ghost" duplicate
   * lines. Return a per-row id that survives `{...row, ...patch}` edits.
   */
  getRowKey?: (row: T, index: number) => React.Key;
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

  /**
   * Per-column context menu shown when the user right-clicks a column header.
   * Map: column id → menu items. Menus are suppressed when the table is
   * `disabled` (read-only / view mode). When the map is empty or undefined
   * for a given column, the header behaves exactly as before — no right-click
   * affordance is added.
   *
   * Column-header right-click is independent of the existing `#` column
   * table-actions menu. Both can coexist on different headers.
   */
  columnContextMenus?: Record<string, ColumnContextMenuItem[]>;

  /**
   * Per-column context menu shown when the user right-clicks any cell in a
   * marked column. Map: column id → menu items. The cell handler calls
   * `event.stopPropagation()` so the row-level right-click menu does not
   * also fire. When the map is empty or undefined for a given column, cells
   * fall through to the row-level handler.
   *
   * The handler is wired on the `<td>` element (not on the cell's input
   * element), so it fires when right-clicking the cell padding as well as
   * the input itself.
   */
  cellContextMenus?: Record<string, ColumnContextMenuItem[]>;
}

type TableSkin = 'classic' | 'web';
type AlternatingRows = 'none' | 'soft' | 'strong';
type TableTextSize = 'compact' | 'normal' | 'large';
type NumberFont = 'mono' | 'tabular' | 'sans';
type TableFont = 'apex' | 'system' | 'mono';
type RowColor = 'amber' | 'blue' | 'green' | 'rose' | 'violet' | 'white';

type TablePreferences = {
  skin: TableSkin;
  alternatingRows: AlternatingRows;
  textSize: TableTextSize;
  numberFont: NumberFont;
  tableFont: TableFont;
  lineColor1: RowColor;
  lineColor2: RowColor;
  /** Persisted column order by column id. New columns appear at the end. */
  columnOrder?: string[];
};

const defaultPreferences: TablePreferences = {
  skin: 'classic',
  alternatingRows: 'soft',
  textSize: 'compact',
  numberFont: 'mono',
  tableFont: 'apex',
  lineColor1: 'blue',
  lineColor2: 'green',
};

type ContextMenuState =
  | { type: 'row'; x: number; y: number; rowIndex: number }
  | { type: 'table'; x: number; y: number }
  | { type: 'columnHeader'; x: number; y: number; columnId: string }
  | { type: 'cell'; x: number; y: number; columnId: string; rowIndex: number };

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

/**
 * Display a number with at least `minDecimals` decimals, but preserve any
 * extra precision the user typed. 25 → "25.00", 25.5 → "25.50",
 * 25.575 → "25.575".
 */
const formatMinDecimals = (value: any, minDecimals = 2): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const text = String(n);
  const dotIdx = text.indexOf('.');
  const naturalDecimals = dotIdx === -1 ? 0 : text.length - dotIdx - 1;
  return n.toFixed(Math.max(minDecimals, naturalDecimals));
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

const tableFontClasses: Record<TableFont, string> = {
  apex: 'font-sans',
  system: '[font-family:var(--app-font-family),ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,sans-serif]',
  mono: 'font-mono',
};

const parseColumnWidth = (width: string | undefined): number => {
  if (!width) return 140;
  const parsed = Number.parseInt(width, 10);
  return Number.isFinite(parsed) ? parsed : 140;
};

// Inline-style backgrounds. Tailwind utility ordering can make stacked bg-*
// classes unpredictable; inline style guarantees the row color paints.
// Tailwind 100-scale * opacity
const rowColorStrongRgb: Record<RowColor, string> = {
  amber: 'rgba(254, 243, 199, 0.80)',
  blue: 'rgba(219, 234, 254, 0.75)',
  green: 'rgba(209, 250, 229, 0.75)',
  rose: 'rgba(255, 228, 230, 0.75)',
  violet: 'rgba(237, 233, 254, 0.75)',
  white: 'rgba(255, 255, 255, 1)',
};

// Tailwind 50-scale * opacity
const rowColorSoftRgb: Record<RowColor, string> = {
  amber: 'rgba(255, 251, 235, 0.70)',
  blue: 'rgba(239, 246, 255, 0.70)',
  green: 'rgba(236, 253, 245, 0.70)',
  rose: 'rgba(255, 241, 242, 0.70)',
  violet: 'rgba(245, 243, 255, 0.70)',
  white: 'rgba(255, 255, 255, 1)',
};

const rowColorSwatches: Array<{ color: RowColor; className: string; labelKey: string; fallback: string }> = [
  { color: 'amber', className: 'bg-amber-300 ring-amber-500', labelKey: 'lineItemsTable.menu.rowColorAmber', fallback: 'Amber' },
  { color: 'blue', className: 'bg-blue-300 ring-blue-500', labelKey: 'lineItemsTable.menu.rowColorBlue', fallback: 'Blue' },
  { color: 'green', className: 'bg-emerald-300 ring-emerald-500', labelKey: 'lineItemsTable.menu.rowColorGreen', fallback: 'Green' },
  { color: 'rose', className: 'bg-rose-300 ring-rose-500', labelKey: 'lineItemsTable.menu.rowColorRose', fallback: 'Rose' },
  { color: 'violet', className: 'bg-violet-300 ring-violet-500', labelKey: 'lineItemsTable.menu.rowColorViolet', fallback: 'Violet' },
  { color: 'white', className: 'bg-white ring-slate-300 dark:bg-slate-800 dark:ring-slate-600', labelKey: 'lineItemsTable.menu.rowColorWhite', fallback: 'White' },
];

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
    getRowKey,
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
    columnContextMenus,
    cellContextMenus,
  } = props;

  // The trailing trash column is intentionally hidden; row deletion stays
  // available via the row right-click context menu when onRowRemove is set.
  const showRemove = false;
  const storageKey = `erp03.lineItemsTable.${tableId}.preferences`;
  const widthStorageKey = `erp03.lineItemsTable.${tableId}.columnWidths`;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
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
  const [prefsTab, setPrefsTab] = useState<'layout' | 'typography' | 'columns'>('layout');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Row highlight and row color are transient, per-document markers — NOT
  // persisted to localStorage. Persisting them by row index under a shared
  // tableId made the same rows appear highlighted/colored across every document
  // of that type; keeping them in component state scopes them to the open
  // document and resets on navigation.
  const [highlightedRows, setHighlightedRows] = useState<Set<number>>(() => new Set());
  const [rowColors, setRowColors] = useState<Record<number, RowColor>>(() => ({}));

  // Effective column order: persisted preference first, with new (unseen)
  // columns appended in their original order so adding columns later still
  // shows up without losing the user's prior arrangement.
  const orderedColumns = useMemo(() => {
    const order = preferences.columnOrder || [];
    const byId = new Map(columns.map((col) => [col.id, col] as const));
    const seen = new Set<string>();
    const result: ColumnDef<T>[] = [];
    for (const id of order) {
      const col = byId.get(id);
      if (col && !seen.has(id)) {
        result.push(col);
        seen.add(id);
      }
    }
    for (const col of columns) {
      if (!seen.has(col.id)) {
        result.push(col);
        seen.add(col.id);
      }
    }
    return result;
  }, [columns, preferences.columnOrder]);

  const moveColumn = (columnId: string, delta: -1 | 1) => {
    setPreferences((current) => {
      const baseOrder = orderedColumns.map((col) => col.id);
      const idx = baseOrder.indexOf(columnId);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= baseOrder.length) return current;
      const next = baseOrder.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...current, columnOrder: next };
    });
  };

  const resetColumnOrder = () => {
    setPreferences((current) => ({ ...current, columnOrder: undefined }));
  };

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

  // (Row highlight and row color are intentionally in-memory only — see
  // highlightedRows / rowColors above.)

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

  const setRowColor = (rowIndex: number, color: RowColor | null) => {
    setRowColors((current) => {
      const next = { ...current };
      if (color) next[rowIndex] = color;
      else delete next[rowIndex];
      return next;
    });
    setHighlightedRows((current) => {
      if (color || !current.has(rowIndex)) return current;
      const next = new Set(current);
      next.delete(rowIndex);
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
    setRowColors({});
    toast.success(t('lineItemsTable.toast.tableCleaned', 'Table cleaned'));
    closeContextMenu();
  };

  const exportCsv = () => {
    const headers = orderedColumns.map((column) => column.label);
    const body = rows.filter(rowIsFilled).map((row, rowIndex) =>
      orderedColumns.map((column) => {
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
          return orderedColumns.reduce<Record<string, unknown>>((row, column, index) => {
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

  // Enter inside an editable table cell advances focus to the next editable
  // cell, wrapping from the last cell of a row to the first cell of the next
  // row (and from the last cell of the table back to the first). Native
  // inputs/selects handle Enter on bubble — any in-cell handler that calls
  // preventDefault still allows the event to reach us here.
  const handleTbodyKeyDown = (event: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) return;
    const target = event.target as HTMLElement;
    const tag = target.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
    if ((target as HTMLInputElement).type === 'button') return;
    const tbody = tbodyRef.current;
    if (!tbody) return;
    const focusables = Array.from(
      tbody.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]):not([type="button"]), select:not([disabled]), textarea:not([disabled])',
      ),
    ).filter((el) => el.offsetParent !== null);
    const idx = focusables.indexOf(target);
    if (idx < 0) return;
    event.preventDefault();
    const next = focusables[(idx + 1) % focusables.length];
    if (!next) return;
    next.focus();
    // Bring the new target's row into view so rows beyond the visible window
    // aren't visually skipped. block: 'nearest' avoids jarring jumps when the
    // target is already on-screen.
    const nextRow = next.closest('tr');
    nextRow?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
      try { next.select(); } catch { /* noop */ }
    }
  };

  const renderCell = (row: T, rowIndex: number, col: ColumnDef<T>): React.ReactNode => {
    const cellOnChange = rowChangeFor(rowIndex);

    switch (col.kind) {
      case 'custom':
        return col.render ? col.render(row, rowIndex, cellOnChange) : null;

      case 'computed': {
        const raw = col.compute ? col.compute(row, rowIndex) : '';
        const isBlankPlaceholderZero = !rowIsFilled(row) && (raw === 0 || raw === '0' || raw === '0.00');
        const numericValue = typeof raw === 'number' ? raw : Number(raw);

        // Back-solving cells: editable, type a total → row patch applied.
        if (col.solveFromTotal && !disabled) {
          return (
            <NumericCell
              value={isBlankPlaceholderZero ? '' : numericValue}
              align={col.align ?? 'right'}
              textSizeClass={textSizeClasses[preferences.textSize]}
              numberFontClass={numberFontClasses[preferences.numberFont]}
              computedBg
              onCommit={(n) => cellOnChange(col.solveFromTotal!(n, row, rowIndex))}
            />
          );
        }

        const formatted = col.formatter
          ? col.formatter(raw)
          : typeof raw === 'number'
            ? formatMinDecimals(raw, col.decimals ?? 2)
            : String(raw ?? '');
        const justify = col.align === 'left' ? 'justify-start' : col.align === 'center' ? 'justify-center' : 'justify-end';
        return (
          <div className={`px-3 py-2 h-9 flex items-center font-bold text-slate-900 dark:text-slate-100 bg-slate-50/40 dark:bg-slate-900/30 ${textSizeClasses[preferences.textSize]} ${numberFontClasses[preferences.numberFont]} ${alignClass(col.align)} ${justify}`}>
            {isBlankPlaceholderZero ? '' : formatted}
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
            onFocus={(event) => { try { event.currentTarget.select(); } catch { /* noop */ } }}
            onChange={(e) => col.setter && cellOnChange(col.setter(e.target.value))}
            className={`w-full h-9 px-2 bg-transparent border-0 outline-none ${textSizeClasses[preferences.textSize]} text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignClass(col.align)}`}
          />
        );
      }

      case 'number': {
        const value = col.accessor ? col.accessor(row) : '';
        return (
          <NumericCell
            value={value}
            align={col.align ?? 'right'}
            textSizeClass={textSizeClasses[preferences.textSize]}
            numberFontClass={numberFontClasses[preferences.numberFont]}
            disabled={disabled}
            onCommit={(n) => { if (col.setter) cellOnChange(col.setter(n)); }}
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
    // Explicit per-type branches. We must NOT fall through to a default
    // `else` here: when a new menu type (e.g. 'columnHeader' / 'cell') is
    // added, the legacy `else` block silently rendered the table-actions
    // menu, which is the wrong UX. Each branch returns the correct list
    // for its type, and the default returns null.
    let body: React.ReactNode = null;
    if (contextMenu.type === 'row') {
      body = (
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
          <div className="px-3 py-2">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
              {t('lineItemsTable.menu.rowColor', 'Row color')}
            </div>
            <div className="flex items-center gap-1.5">
              {rowColorSwatches.map((swatch) => (
                <button
                  key={swatch.color}
                  type="button"
                  onClick={() => setRowColor(contextMenu.rowIndex, swatch.color)}
                  className={`h-5 w-5 rounded-sm ring-offset-1 ring-offset-white transition ${swatch.className} ${rowColors[contextMenu.rowIndex] === swatch.color ? 'ring-2' : 'ring-0 hover:ring-1'} dark:ring-offset-slate-900`}
                  title={t(swatch.labelKey, swatch.fallback)}
                />
              ))}
              <button
                type="button"
                onClick={() => setRowColor(contextMenu.rowIndex, null)}
                className="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title={t('lineItemsTable.menu.clearRowColor', 'Clear row color')}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button type="button" onClick={() => deleteRow(contextMenu.rowIndex)} disabled={!canEditRows || !onRowRemove} className={dangerMenuButtonClass}>
            <Trash2 className="h-3.5 w-3.5" /> {t('lineItemsTable.menu.delete', 'Delete')}
          </button>
        </>
      );
    } else if (contextMenu.type === 'table') {
      body = (
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
      );
    } else if (contextMenu.type === 'columnHeader' || contextMenu.type === 'cell') {
      const menuItems =
        contextMenu.type === 'columnHeader'
          ? columnContextMenus?.[contextMenu.columnId]
          : cellContextMenus?.[contextMenu.columnId];
      const rowIndex = contextMenu.type === 'cell' ? contextMenu.rowIndex : undefined;
      if (menuItems && menuItems.length > 0) {
        body = (
          <>
            {menuItems.map((item) => (
              <React.Fragment key={item.key}>
                {item.dividerBefore && <div className="my-1 border-t border-slate-100 dark:border-slate-800" />}
                <button
                  type="button"
                  onClick={() => {
                    if (item.disabled) return;
                    item.onSelect(rowIndex);
                    closeContextMenu();
                  }}
                  disabled={!!item.disabled}
                  className={item.danger ? dangerMenuButtonClass : menuButtonClass}
                >
                  {item.icon}
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </>
        );
      }
    }
    if (body === null) return null;
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
          className="fixed z-[91] w-56 rounded-md border border-slate-200 bg-white py-1.5 shadow-md dark:border-slate-800 dark:bg-slate-900"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {body}
        </div>
      </>
    );
  };

  const renderPreferencesModal = () => {
    if (!showPreferences) return null;
    const setPreference = <K extends keyof TablePreferences>(key: K, value: TablePreferences[K]) =>
      setPreferences((current) => ({ ...current, [key]: value }));

    const tabs: Array<{ id: typeof prefsTab; label: string }> = [
      { id: 'layout', label: t('lineItemsTable.preferences.tabLayout', 'Layout & Colors') },
      { id: 'typography', label: t('lineItemsTable.preferences.tabTypography', 'Typography') },
      { id: 'columns', label: t('lineItemsTable.preferences.tabColumns', 'Columns') },
    ];

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

          <div role="tablist" className="flex border-b border-slate-200 bg-slate-50/60 px-2 dark:border-slate-800 dark:bg-slate-900/60">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={prefsTab === tab.id}
                onClick={() => setPrefsTab(tab.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-[11px] font-black uppercase tracking-wide transition-colors ${
                  prefsTab === tab.id
                    ? 'border-blue-500 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 p-4 text-xs">
            {prefsTab === 'layout' && (
              <>
                <PreferenceGroup label={t('lineItemsTable.preferences.layout', 'Layout')}>
                  <PreferenceButton active={preferences.skin === 'classic'} onClick={() => setPreference('skin', 'classic')} label={t('lineItemsTable.preferences.classic', 'Classic')} />
                  <PreferenceButton active={preferences.skin === 'web'} onClick={() => setPreference('skin', 'web')} label={t('lineItemsTable.preferences.web', 'Web')} />
                </PreferenceGroup>
                <PreferenceGroup label={t('lineItemsTable.preferences.rowColoring', 'Row coloring')}>
                  <PreferenceButton active={preferences.alternatingRows === 'none'} onClick={() => setPreference('alternatingRows', 'none')} label={t('lineItemsTable.preferences.none', 'None')} />
                  <PreferenceButton active={preferences.alternatingRows === 'soft'} onClick={() => setPreference('alternatingRows', 'soft')} label={t('lineItemsTable.preferences.soft', 'Soft')} />
                  <PreferenceButton active={preferences.alternatingRows === 'strong'} onClick={() => setPreference('alternatingRows', 'strong')} label={t('lineItemsTable.preferences.strong', 'Strong')} />
                </PreferenceGroup>
                <PreferenceGroup label={t('lineItemsTable.preferences.lineColor1', 'Line color 1')}>
                  {rowColorSwatches.map((swatch) => (
                    <ColorPreferenceButton
                      key={swatch.color}
                      active={preferences.lineColor1 === swatch.color}
                      className={swatch.className}
                      label={t(swatch.labelKey, swatch.fallback)}
                      onClick={() => setPreference('lineColor1', swatch.color)}
                    />
                  ))}
                </PreferenceGroup>
                <PreferenceGroup label={t('lineItemsTable.preferences.lineColor2', 'Line color 2')}>
                  {rowColorSwatches.map((swatch) => (
                    <ColorPreferenceButton
                      key={swatch.color}
                      active={preferences.lineColor2 === swatch.color}
                      className={swatch.className}
                      label={t(swatch.labelKey, swatch.fallback)}
                      onClick={() => setPreference('lineColor2', swatch.color)}
                    />
                  ))}
                </PreferenceGroup>
              </>
            )}

            {prefsTab === 'typography' && (
              <>
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
                <PreferenceGroup label={t('lineItemsTable.preferences.tableFont', 'Table font')}>
                  <PreferenceButton active={preferences.tableFont === 'apex'} onClick={() => setPreference('tableFont', 'apex')} label={t('lineItemsTable.preferences.apexFont', 'Apex / Inter')} />
                  <PreferenceButton active={preferences.tableFont === 'system'} onClick={() => setPreference('tableFont', 'system')} label={t('lineItemsTable.preferences.system', 'System')} />
                  <PreferenceButton active={preferences.tableFont === 'mono'} onClick={() => setPreference('tableFont', 'mono')} label={t('lineItemsTable.preferences.mono', 'Mono')} />
                </PreferenceGroup>
              </>
            )}

            {prefsTab === 'columns' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                    {t('lineItemsTable.preferences.columnOrder', 'Column order')}
                  </span>
                  <button
                    type="button"
                    onClick={resetColumnOrder}
                    disabled={!preferences.columnOrder}
                    className="text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-900 disabled:opacity-40 dark:hover:text-slate-100"
                  >
                    {t('lineItemsTable.preferences.resetOrder', 'Reset')}
                  </button>
                </div>
                <ol className="flex max-h-[420px] flex-col gap-1 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                  {orderedColumns.map((col, idx) => (
                    <li
                      key={col.id}
                      className="flex items-center gap-2 rounded bg-white px-2 py-1.5 dark:bg-slate-900"
                    >
                      <span className="w-5 shrink-0 text-center font-mono text-[10px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                      <span className="flex-1 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        {col.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => moveColumn(col.id, -1)}
                        disabled={idx === 0}
                        title={t('lineItemsTable.preferences.moveUp', 'Move up')}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(col.id, 1)}
                        disabled={idx === orderedColumns.length - 1}
                        title={t('lineItemsTable.preferences.moveDown', 'Move down')}
                        className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Mobile card list: show filled rows plus a single trailing blank row to fill.
  // Avoids rendering all 25 padded edit rows as cards on a phone.
  const mobileEntries = (() => {
    const filled = visibleEntries.filter(({ row }) => rowIsFilled(row));
    if (disabled) return filled;
    const firstEmpty = visibleEntries.find(({ row }) => !rowIsFilled(row));
    return firstEmpty ? [...filled, firstEmpty] : filled;
  })();

  return (
    <div
      className={`flex flex-col border border-slate-200 dark:border-slate-800 rounded overflow-hidden shadow-sm bg-white dark:bg-slate-950 ${tableFontClasses[preferences.tableFont]} ${preferences.skin === 'web' ? 'rounded-md' : ''} ${className}`}
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
        className="hidden md:block flex-1 min-h-0 overflow-y-auto overflow-x-auto [&_input::placeholder]:text-transparent [&_input::placeholder]:opacity-0"
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
              {orderedColumns.map((col) => {
                const hasColumnMenu = !disabled && !!(columnContextMenus && columnContextMenus[col.id]?.length);
                return (
                <th
                  key={col.id}
                  className={`relative p-2 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide border-r border-slate-200 dark:border-slate-800 ${alignClass(col.align)} ${hasColumnMenu ? 'cursor-context-menu' : ''}`}
                  style={{ width: `${getColumnWidth(col)}px`, minWidth: `${getColumnWidth(col)}px` }}
                  onContextMenu={hasColumnMenu
                    ? (event) => {
                        event.preventDefault();
                        setContextMenu({ type: 'columnHeader', x: event.clientX, y: event.clientY, columnId: col.id });
                      }
                    : undefined}
                  title={
                    col.labelTitle
                      ? col.labelTitle
                      : hasColumnMenu
                        ? t('lineItemsTable.menu.columnActions', 'Right-click for column actions')
                        : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {col.labelExtras}
                  </span>
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
                );
              })}
              {showRemove && <th className="p-2 w-10" aria-label="Actions" />}
            </tr>
          </thead>

          <tbody ref={tbodyRef} onKeyDown={handleTbodyKeyDown}>
            {visibleEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={(showRowNumbers ? 1 : 0) + orderedColumns.length + (showRemove ? 1 : 0)}
                  className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleEntries.map(({ row, rowIndex }, displayIndex) => {
                const isHighlighted = highlightedRows.has(rowIndex);
                const manualRowColor = rowColors[rowIndex];
                const alternatingBg = (() => {
                  if (preferences.alternatingRows === 'none') return undefined;
                  const which = displayIndex % 2 === 1 ? preferences.lineColor2 : preferences.lineColor1;
                  return preferences.alternatingRows === 'strong'
                    ? rowColorStrongRgb[which]
                    : rowColorSoftRgb[which];
                })();
                const rowBg = manualRowColor
                  ? rowColorStrongRgb[manualRowColor]
                  : isHighlighted
                    ? rowColorStrongRgb.amber
                    : alternatingBg;
                return (
                <tr
                  key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ type: 'row', x: event.clientX, y: event.clientY, rowIndex });
                  }}
                  style={rowBg ? { backgroundColor: rowBg } : undefined}
                  className={`hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-colors duration-100 border-b border-slate-100 dark:border-slate-800`}
                >
                  {showRowNumbers && (
                    <td className="p-2 text-slate-500 dark:text-slate-400 text-[11px] font-medium text-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20">
                      {displayIndex + 1}
                    </td>
                  )}
                  {orderedColumns.map((col) => {
                    const hasCellMenu = !disabled && !!(cellContextMenus && cellContextMenus[col.id]?.length);
                    return (
                    <td
                      key={col.id}
                      className="p-0 border-r border-slate-100 dark:border-slate-800 align-middle"
                      style={{ width: `${getColumnWidth(col)}px`, minWidth: `${getColumnWidth(col)}px` }}
                      onContextMenu={hasCellMenu
                        ? (event) => {
                            event.preventDefault();
                            // Stop the bubble so the row-level right-click
                            // (which would show the row copy/paste menu) does
                            // not also fire.
                            event.stopPropagation();
                            setContextMenu({
                              type: 'cell',
                              x: event.clientX,
                              y: event.clientY,
                              columnId: col.id,
                              rowIndex,
                            });
                          }
                        : undefined}
                    >
                      <div className={`p-0.5 ${textSizeClasses[preferences.textSize]}`}>{renderCell(row, rowIndex, col)}</div>
                    </td>
                    );
                  })}
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

      {/* Mobile stacked-card view — phones only (<768px). Each line becomes a
          labeled card so all fields are visible without sideways scrolling.
          Reuses renderCell() so every selector / numeric / computed cell edits
          identically to the desktop table. */}
      <div
        className="md:hidden flex-1 min-h-0 space-y-2 overflow-y-auto p-2"
        style={{ maxHeight: maxBodyHeight }}
      >
        {mobileEntries.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
            {emptyMessage}
          </div>
        ) : (
          mobileEntries.map(({ row, rowIndex }, displayIndex) => {
            const [primaryCol, ...restCols] = orderedColumns;
            const manualRowColor = rowColors[rowIndex];
            const cardBg = manualRowColor
              ? rowColorSoftRgb[manualRowColor]
              : highlightedRows.has(rowIndex)
                ? rowColorSoftRgb.amber
                : undefined;
            return (
              <div
                key={getRowKey ? getRowKey(row, rowIndex) : rowIndex}
                style={cardBg ? { backgroundColor: cardBg } : undefined}
                className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    {displayIndex + 1}
                  </span>
                  {primaryCol && (
                    <div className="min-w-0 flex-1 overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                      {renderCell(row, rowIndex, primaryCol)}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(event) => setContextMenu({ type: 'row', x: event.clientX, y: event.clientY, rowIndex })}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label={t('lineItemsTable.menu.rowActions', 'Row actions')}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {restCols.map((col) => {
                    const hasCellMenu = !disabled && !!(cellContextMenus && cellContextMenus[col.id]?.length);
                    return (
                    <div key={col.id} className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {col.label}
                      </span>
                      <div
                        className={`flex min-h-[2.25rem] items-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950 ${hasCellMenu ? 'cursor-context-menu' : ''}`}
                        onContextMenu={hasCellMenu
                          ? (event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setContextMenu({
                                type: 'cell',
                                x: event.clientX,
                                y: event.clientY,
                                columnId: col.id,
                                rowIndex,
                              });
                            }
                          : undefined}
                      >
                        {renderCell(row, rowIndex, col)}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
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

function ColorPreferenceButton({
  active,
  className,
  label,
  onClick,
}: {
  active: boolean;
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex h-7 items-center gap-1 rounded px-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
        active
          ? 'bg-white text-blue-700 shadow-sm ring-1 ring-blue-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-blue-900'
          : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
      }`}
    >
      <span className={`h-3.5 w-3.5 rounded-sm ${className}`} />
      {active && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

/** Characters a numeric cell accepts: digits, decimal point, the four operators,
 *  parentheses and whitespace. Anything else (letters, symbols) is stripped on input. */
const NUMERIC_CELL_ALLOWED = /[^0-9.+\-*/()\s]/g;

/**
 * Safely evaluate a basic arithmetic expression typed into a numeric cell —
 * e.g. "5+5" → 10, "5*5" → 25, "100-5" → 95, "(2+3)*4" → 20. Supports + - * /
 * and parentheses with correct precedence. Uses a small shunting-yard parser
 * (no eval/Function). Returns null for invalid/incomplete input. A lone "-5"
 * evaluates to -5 (callers clamp negatives to 0).
 */
function evaluateNumericExpression(input: string): number | null {
  const expr = input.trim();
  // Non-global test (NUMERIC_CELL_ALLOWED is /g/ and stateful — only use it for replace()).
  if (expr === '' || /[^0-9.+\-*/()\s]/.test(expr)) return null;
  const tokens = expr.match(/(\d+\.?\d*|\.\d+|[+\-*/()])/g);
  if (!tokens) return null;

  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const output: string[] = [];
  const ops: string[] = [];
  let prev: 'num' | 'op' | 'open' | 'close' | null = null;

  for (const tk of tokens) {
    if (/^[\d.]/.test(tk)) {
      output.push(tk);
      prev = 'num';
    } else if (tk === '(') {
      ops.push(tk);
      prev = 'open';
    } else if (tk === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop() as string);
      if (!ops.length) return null;
      ops.pop();
      prev = 'close';
    } else {
      // Unary +/- at the start or after another operator/open paren → treat as (0 ± x).
      if ((tk === '-' || tk === '+') && (prev === null || prev === 'op' || prev === 'open')) {
        output.push('0');
      }
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[tk]) {
        output.push(ops.pop() as string);
      }
      ops.push(tk);
      prev = 'op';
    }
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === '(') return null;
    output.push(op);
  }

  const stack: number[] = [];
  for (const tk of output) {
    if (/^[\d.]/.test(tk)) {
      stack.push(parseFloat(tk));
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    let r: number;
    if (tk === '+') r = a + b;
    else if (tk === '-') r = a - b;
    else if (tk === '*') r = a * b;
    else r = b === 0 ? NaN : a / b;
    stack.push(r);
  }
  if (stack.length !== 1) return null;
  const result = stack[0];
  if (!Number.isFinite(result)) return null;
  // Trim binary-float noise (e.g. 0.1+0.2) while preserving real precision.
  return Math.round(result * 1e6) / 1e6;
}

/**
 * NumericCell — text input that shows min 2 decimals (preserves extra
 * precision) when unfocused, and the raw editable value when focused.
 *
 * Rules:
 *  - Value 0 or empty → cell renders blank (visually). The underlying value
 *    stays 0, so math doesn't break.
 *  - On focus with a non-zero value → input shows the raw number and the
 *    content is selected, so the user can immediately overwrite.
 *  - On focus with 0/empty → input stays blank, ready to type.
 *  - On blur, empty draft commits as 0; otherwise the parsed number commits.
 */
function NumericCell({
  value,
  align,
  textSizeClass,
  numberFontClass,
  disabled,
  computedBg,
  onCommit,
}: {
  value: number | string | null | undefined;
  align: 'left' | 'right' | 'center';
  textSizeClass: string;
  numberFontClass: string;
  disabled?: boolean;
  computedBg?: boolean;
  onCommit: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isEmpty = value === '' || value === null || value === undefined;
  const numeric = isEmpty ? 0 : Number(value);
  const showAsBlank = isEmpty || numeric === 0;
  const displayed = focused ? draft : showAsBlank ? '' : formatMinDecimals(numeric);
  const alignTextClass = align === 'right' ? 'text-right' : align === 'left' ? 'text-left' : 'text-center';

  // Re-select after React swaps the value on focus. A synchronous select()
  // inside onFocus gets clobbered by the displayed-value change on the next
  // render; running it from an effect after the render preserves the highlight.
  useEffect(() => {
    if (!focused) return;
    const el = inputRef.current;
    if (el && el.value.length > 0) {
      try { el.select(); } catch { /* noop */ }
    }
  }, [focused]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={displayed}
      disabled={disabled}
      onFocus={() => {
        setFocused(true);
        setDraft(showAsBlank ? '' : String(numeric));
      }}
      onBlur={() => {
        setFocused(false);
        const trimmed = draft.trim();
        if (trimmed === '') {
          onCommit(0);
          return;
        }
        // Evaluate as arithmetic (5+5 → 10, 100-5 → 95). Invalid/incomplete input
        // reverts to the previous value; negatives are clamped to 0 (no negatives).
        const evaluated = evaluateNumericExpression(trimmed);
        const next = evaluated === null ? numeric : evaluated;
        onCommit(Math.max(0, Number.isFinite(next) ? next : 0));
      }}
      onChange={(event) => setDraft(event.target.value.replace(NUMERIC_CELL_ALLOWED, ''))}
      className={`w-full h-9 px-2 bg-transparent border-0 outline-none ${textSizeClass} ${numberFontClass} ${computedBg ? 'font-bold bg-slate-50/40 dark:bg-slate-900/30' : ''} text-slate-900 dark:text-slate-100 focus:bg-blue-50/40 dark:focus:bg-blue-950/20 ${alignTextClass}`}
    />
  );
}

export default ClassicLineItemsTable;
