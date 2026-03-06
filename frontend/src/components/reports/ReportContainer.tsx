import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { exportElementToPDF } from '../../utils/exportUtils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Filter, 
  FileText, 
  Printer, 
  ArrowLeft, 
  Settings, 
  Maximize2,
  Minimize2,
  RefreshCcw
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useWindowManager } from '../../context/WindowManagerContext';

export interface ReportColumn {
  id: string;
  label: string;
  permanent?: boolean;
}

export interface ReportConfig {
  paginated?: boolean;
  defaultPageSize?: number;
  availableColumns?: ReportColumn[];
  density?: 'compact' | 'comfortable';
}

interface ReportContainerProps<TParams> {
  title: string;
  subtitle?: string;
  initiator: React.FC<{ 
    onSubmit: (params: TParams) => void; 
    initialParams?: TParams | null; 
    isModal?: boolean 
  }>;
  ReportContent: React.FC<{ 
    params: TParams; 
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
  }>;
  onExportExcel?: (params: TParams) => void;
  defaultParams?: TParams;
  config?: ReportConfig;
  isWindow?: boolean;
}

export function ReportContainer<TParams>({
  title,
  subtitle,
  initiator: Initiator,
  ReportContent,
  onExportExcel,
  defaultParams,
  config = { paginated: true, defaultPageSize: 50 },
  isWindow = false
}: ReportContainerProps<TParams>) {
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const { openWindow } = useWindowManager();
  const [params, setParams] = useState<TParams | null>(defaultParams || null);
  const [isGenerated, setIsGenerated] = useState(!!defaultParams);
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.defaultPageSize || 50);
  const [totalItems, setTotalItems] = useState(0);

  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(
    config.availableColumns?.map(c => c.id) || []
  );
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [density, setDensity] = useState<'compact' | 'comfortable'>(config.density || 'comfortable');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (config.availableColumns && (visibleColumnIds.length === 0)) {
      setVisibleColumnIds(config.availableColumns.map(c => c.id));
    }
  }, [config.availableColumns]);

  const toggleColumn = (id: string) => {
    setVisibleColumnIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleRunReport = (newParams: TParams) => {
    if (uiMode === 'windows' && !isWindow) {
      // In Windows mode, the launcher opens a new window instead of loading here
      openWindow({
        type: 'report',
        title: `${title}${ (newParams as any).accountName ? `: ${(newParams as any).accountName}` : '' }`,
        data: {
          title, subtitle, initiator: Initiator, ReportContent, 
          onExportExcel, defaultParams: newParams, config, isWindow: true
        }
      });
      return;
    }
    setParams(newParams);
    setIsGenerated(true);
    setPage(1);
    setIsFilterModalOpen(false);
  };

  const handleEditFilters = () => setIsFilterModalOpen(true);
  const handleReset = () => setIsGenerated(false);
  const handlePrint = () => window.print();
  const handleRefresh = () => setRefreshKey(prev => prev + 1);

  if (!isGenerated) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 min-h-full">
        <div className="w-full max-w-5xl pb-[20vh]">
          <div className="mb-8 pl-4 border-l-4 border-slate-900">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">{title}</h1>
            <p className="text-slate-500 dark:text-slate-300 text-sm mt-1">{subtitle}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-8 max-w-5xl w-full">
            <Initiator onSubmit={handleRunReport} initialParams={null} />
          </div>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 z-30 print:hidden shadow-sm">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-0">
            <ArrowLeft size={20} />
          </Button>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 uppercase font-semibold tracking-wider font-mono">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-1 border border-slate-200 dark:border-slate-700">
             <button onClick={() => setDensity('comfortable')} className={`p-1.5 rounded transition-all ${density === 'comfortable' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-950 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                <Maximize2 size={14} />
             </button>
             <button onClick={() => setDensity('compact')} className={`p-1.5 rounded transition-all ${density === 'compact' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-950 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                <Minimize2 size={14} />
             </button>
          </div>
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold gap-2">
            <RefreshCcw size={16} /> <span className="hidden lg:inline">{t('reportContainer.refresh', { defaultValue: 'Refresh' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleEditFilters} className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold gap-2">
            <Filter size={16} /> <span className="hidden lg:inline">{t('reportContainer.filters', { defaultValue: 'Filters' })}</span>
          </Button>
          {config.availableColumns && (
            <div className="relative">
              <Button variant="ghost" size="sm" onClick={() => setIsSettingsOpen(!isSettingsOpen)} className={`text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold gap-2 ${isSettingsOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}>
                <Settings size={16} /> <span className="hidden lg:inline">{t('reportContainer.columns', { defaultValue: 'Columns' })}</span>
              </Button>
              {isSettingsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 shadow-xl z-50 py-1 rounded-sm">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">{t('reportContainer.visibility', { defaultValue: 'Visibility' })}</span>
                    </div>
                    {config.availableColumns.map(col => (
                      <label key={col.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <input type="checkbox" checked={visibleColumnIds.includes(col.id)} disabled={col.permanent} onChange={() => !col.permanent && toggleColumn(col.id)} className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
          <div className="flex gap-1">
            {onExportExcel && (
              <Button variant="ghost" size="sm" onClick={() => params && onExportExcel(params)} className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 p-2"><Download size={18} /></Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => exportElementToPDF('report-content', title)} className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 p-2"><FileText size={18} /></Button>
            <Button variant="ghost" size="sm" onClick={handlePrint} className="text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 p-2"><Printer size={18} /></Button>
          </div>
        </div>
      </div>

      {/* Main Report Area - Height Managed by flex-1 */}
      <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-slate-950" id="report-content">
        {params && (
          <ReportContent 
            key={refreshKey}
            params={params} 
            pagination={config.paginated ? {
              page,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: (size) => { setPageSize(size); setPage(1); },
              totalItems,
            } : undefined}
            setTotalItems={setTotalItems}
            visibleColumns={visibleColumnIds}
            density={density}
          />
        )}
      </div>

      {/* Persistence Bar / Footer */}
      {config.paginated && isGenerated && (
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 px-6 py-2.5 flex items-center justify-between shrink-0 print:hidden shadow-sm">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('reportContainer.page', { defaultValue: 'Page' })}</span>
              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-sm bg-slate-50 dark:bg-slate-800">{page} / {totalPages || 1}</span>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('reportContainer.rows', { defaultValue: 'Rows' })}</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="text-[11px] border-slate-200 dark:border-slate-700 rounded-sm focus:ring-0 py-0.5 font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                {[25, 50, 100, 250, 500].map(size => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-3">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('reportContainer.total', { defaultValue: 'Total' })}</span>
               <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">{totalItems}</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 pr-6 border-r border-slate-100 dark:border-slate-700">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('reportContainer.referenceDate', { defaultValue: 'Ref. Date' })}</span>
                <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">{new Date().toLocaleDateString()}</span>
             </div>
             <div className="flex gap-px bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="bg-white dark:bg-slate-900 px-2 py-1 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-600 border-r border-slate-100 dark:border-slate-700">
                  <ChevronLeft size={14} />
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="bg-white dark:bg-slate-900 px-2 py-1 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-600">
                  <ChevronRight size={14} />
                </button>
             </div>
          </div>
        </div>
      )}

      <Modal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} title={t('reportContainer.configure', { defaultValue: 'Configure {{title}}', title })}>
        <Initiator initialParams={params} onSubmit={handleRunReport} isModal={true} />
      </Modal>
    </div>
  );
}
