import { useMemo } from 'react';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { ColumnDefinition, ResponsiveColumn } from './types';

const STORAGE_KEY_PREFIX = 'erp_datatable_columns_';

function loadUserOverrides(tableId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tableId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUserOverrides(tableId: string, visibleKeys: string[]) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${tableId}`, JSON.stringify(visibleKeys));
  } catch {
    // localStorage unavailable
  }
}

function getBreakpointMaxPriority(isSm: boolean, isLg: boolean): number {
  if (isLg) return 3;
  if (isSm) return 2;
  return 1;
}

export function useResponsiveColumns<T>(
  columns: ColumnDefinition<T>[],
  tableId: string
): {
  visibleColumns: ResponsiveColumn<T>[];
  allVisibleKeys: string[];
  isColumnVisible: (key: string) => boolean;
  toggleColumn: (key: string) => void;
  resetColumns: () => void;
} {
  const isSm = useBreakpoint('sm');
  const isLg = useBreakpoint('lg');

  const maxPriority = getBreakpointMaxPriority(isSm, isLg);

  const result = useMemo(() => {
    const overrides = loadUserOverrides(tableId);

    let filtered: ColumnDefinition<T>[];

    if (overrides) {
      filtered = columns.filter(col => overrides.includes(col.key));
    } else {
      filtered = columns.filter(col => col.priority <= maxPriority);
    }

    if (filtered.length === 0) {
      filtered = columns.filter(col => col.priority === 1);
    }

    const totalWidth = filtered.reduce((sum, col) => {
      const num = parseFloat(col.width);
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

    const visibleColumns: ResponsiveColumn<T>[] = filtered.map(col => {
      const num = parseFloat(col.width);
      const computedWidth = totalWidth > 0 && !isNaN(num)
        ? `${(num / totalWidth) * 100}%`
        : `${100 / filtered.length}%`;

      return { ...col, computedWidth };
    });

    const allVisibleKeys = visibleColumns.map(c => c.key);

    const isColumnVisible = (key: string) => allVisibleKeys.includes(key);

    const toggleColumn = (key: string) => {
      const currentOverrides = overrides ?? columns
        .filter(col => col.priority <= maxPriority)
        .map(col => col.key);

      const next = currentOverrides.includes(key)
        ? currentOverrides.filter(k => k !== key)
        : [...currentOverrides, key];

      if (next.length === 0) return;

      saveUserOverrides(tableId, next);
    };

    const resetColumns = () => {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tableId}`);
    };

    return { visibleColumns, allVisibleKeys, isColumnVisible, toggleColumn, resetColumns };
  }, [columns, tableId, maxPriority]);

  return result;
}
