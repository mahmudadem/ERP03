import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ColumnDefinition } from '../ui/DataTable/types';
import { Spinner } from '../ui/Spinner';
import { ArrowUp, ArrowDown, Filter, Search } from 'lucide-react';
import { Input } from '../ui/Input';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}

export interface ReportColumnDefinition<T = any> extends Omit<ColumnDefinition<T>, 'render'> {
  render?: (value: any, row: T, index: number) => React.ReactNode;
  getCellClassName?: (value: any, row: T) => string;
  getCellStyle?: (value: any, row: T) => React.CSSProperties;
}

export interface ReportTableProps<T, TParams> {
  // Injected by ReportContainer
  params?: TParams;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    totalItems: number;
  };
  setTotalItems?: (total: number) => void;
  visibleColumns?: string[];
  density?: 'compact' | 'comfortable';

  // Specific to ReportTable
  columns: ReportColumnDefinition<T>[];
  fetchData: (params: TParams, page: number, pageSize: number) => Promise<{ data: T[]; total: number }>;
  idKey: keyof T | ((row: T) => string);
  rowContextMenu?: (row: T) => ContextMenuAction[];
}

export function ReportTable<T, TParams>({
  params,
  pagination,
  setTotalItems,
  visibleColumns,
  density = 'comfortable',
  columns,
  fetchData,
  idKey,
  rowContextMenu
}: ReportTableProps<T, TParams>) {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, actions: ContextMenuAction[] } | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  
  // Filtering State
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  // Close context menu and filter popover when clicking anywhere else
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setActiveFilterColumn(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Fetch data
  useEffect(() => {
    let isMounted = true;
    async function load() {
      if (!params) return;
      setIsLoading(true);
      setError(null);
      try {
        const page = pagination?.page || 1;
        const pageSize = pagination?.pageSize || 50;
        const result = await fetchData(params, page, pageSize);
        if (isMounted) {
          setData(result.data);
          if (setTotalItems) setTotalItems(result.total);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to fetch report data');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [params, pagination?.page, pagination?.pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply Local Filtering and Sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filter
    Object.keys(filters).forEach(key => {
      const filterValue = filters[key].toLowerCase();
      if (!filterValue) return;
      
      result = result.filter(row => {
        const colDef = columns.find(c => c.key === key);
        let cellValue = (row as any)[key];
        if (colDef) {
          if (typeof colDef.accessor === 'function') {
            cellValue = colDef.accessor(row);
          } else if (typeof colDef.accessor === 'string') {
            cellValue = (row as any)[colDef.accessor];
          }
        }
        if (cellValue === null || cellValue === undefined) return false;
        return String(cellValue).toLowerCase().includes(filterValue);
      });
    });

    // 2. Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const colDef = columns.find(c => c.key === sortConfig.key);
        let valA = (a as any)[sortConfig.key];
        let valB = (b as any)[sortConfig.key];
        
        if (colDef) {
          if (typeof colDef.accessor === 'function') {
            valA = colDef.accessor(a);
            valB = colDef.accessor(b);
          } else if (typeof colDef.accessor === 'string') {
            valA = (a as any)[colDef.accessor];
            valB = (b as any)[colDef.accessor];
          }
        }

        if (valA === valB) return 0;
        
        const aLessB = valA < valB ? -1 : 1;
        return sortConfig.direction === 'asc' ? aLessB : -aLessB;
      });
    }

    return result;
  }, [data, filters, sortConfig, columns]);

  // Filter columns based on visibility settings
  const activeColumns = useMemo(() => {
    let cols = columns;
    if (visibleColumns && visibleColumns.length > 0) {
      cols = columns.filter((col) => visibleColumns.includes(col.key as string));
    }
    return cols;
  }, [columns, visibleColumns]);

  // Calculate empty columns to reach 12
  const paddingColumnsCount = Math.max(0, 12 - activeColumns.length);
  const paddingColumns = Array.from({ length: paddingColumnsCount });

  const getRowId = (row: T) => {
    if (typeof idKey === 'function') return idKey(row);
    return String((row as any)[idKey]);
  };

  const handleRightClick = (e: React.MouseEvent, row: T) => {
    if (!rowContextMenu) return;
    const actions = rowContextMenu(row);
    if (actions.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      let x = e.clientX;
      let y = e.clientY;
      const menuWidth = 220; 
      const menuHeight = actions.length * 40 + 20;
      if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
      if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
      
      setContextMenu({ x, y, actions });
    }
  };

  const handleSort = (key: string, isSortable: boolean) => {
    if (!isSortable) return;
    setSortConfig(prev => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null; // toggle off
      }
      return { key, direction: 'asc' };
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const tdClass = density === 'compact' ? 'px-3 py-1.5 text-xs' : 'px-4 py-3 text-sm';
  const thClass = density === 'compact' ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-xs';

  return (
    <div className="flex-1 min-h-0 relative flex flex-col bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 m-4 rounded-lg overflow-hidden">
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="px-4 py-3 bg-red-50 text-red-700 text-sm font-medium border-b border-red-100">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto relative">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-20">
            <tr>
              <th className={`${thClass} font-bold text-slate-500 uppercase tracking-wider w-12 text-center border-r border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800`}>#</th>
              {activeColumns.map((col) => (
                <th key={col.key} className={`${thClass} font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap bg-slate-50 dark:bg-slate-800`}>
                  <div className={`flex items-center gap-2 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                    <div 
                      className={`flex items-center gap-1 ${col.sortable ? 'cursor-pointer hover:text-primary-600 select-none' : ''}`}
                      onClick={() => handleSort(col.key, !!col.sortable)}
                    >
                      {col.label}
                      {sortConfig?.key === col.key && (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                    
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveFilterColumn(activeFilterColumn === col.key ? null : col.key)}
                        className={`p-1 rounded transition-colors ${filters[col.key] ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/30' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300'}`}
                      >
                        <Filter size={12} />
                      </button>
                      
                      {activeFilterColumn === col.key && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg rounded-md p-2 z-50">
                          <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              type="text"
                              autoFocus
                              placeholder="Filter..."
                              value={filters[col.key] || ''}
                              onChange={(e) => handleFilterChange(col.key, e.target.value)}
                              className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-primary-500 outline-none bg-transparent"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              ))}
              {paddingColumns.map((_, i) => (
                <th key={`pad-th-${i}`} className={`${thClass} text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-slate-800`}>-</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 relative z-0">
            {processedData.length === 0 && !isLoading && !error && (
              <tr>
                <td colSpan={activeColumns.length + paddingColumnsCount + 1} className="py-12 text-center text-slate-500">
                  No data found for this report.
                </td>
              </tr>
            )}
            
            {processedData.map((row, index) => {
              const lineNum = ((pagination?.page || 1) - 1) * (pagination?.pageSize || 50) + index + 1;
              return (
                <tr 
                  key={getRowId(row)} 
                  onContextMenu={(e) => handleRightClick(e, row)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <td className={`${tdClass} text-center font-mono text-slate-400 dark:text-slate-500 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition-colors`}>
                    {lineNum}
                  </td>
                  {activeColumns.map((col) => {
                    let cellValue = (row as any)[col.key];
                    if (typeof col.accessor === 'function') {
                      cellValue = col.accessor(row);
                    } else if (typeof col.accessor === 'string') {
                      cellValue = (row as any)[col.accessor];
                    }

                    const customClassName = col.getCellClassName ? col.getCellClassName(cellValue, row) : '';
                    const customStyle = col.getCellStyle ? col.getCellStyle(cellValue, row) : {};

                    return (
                      <td 
                        key={col.key} 
                        style={customStyle}
                        className={`${tdClass} text-slate-900 dark:text-slate-100 whitespace-nowrap ${col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : 'text-left'} ${customClassName}`}
                      >
                        {col.render ? col.render(cellValue, row, index) : cellValue}
                      </td>
                    );
                  })}
                  {paddingColumns.map((_, i) => (
                    <td key={`pad-td-${i}`} className={`${tdClass} text-slate-200 dark:text-slate-700`}></td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Context Menu Portal */}
      {contextMenu && createPortal(
        <div 
          className="fixed z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl rounded-md py-1 min-w-[200px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
          {contextMenu.actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick();
                setContextMenu(null);
              }}
              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
                ${action.destructive ? 'text-red-600 hover:text-red-700' : 'text-slate-700 dark:text-slate-200'}
              `}
            >
              {action.icon && <span className="text-slate-400 shrink-0">{action.icon}</span>}
              <span className="font-medium">{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
