
import React, { useState, useEffect } from 'react';
import { accountingApi } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { CostCenterSelector } from '../components/shared/CostCenterSelector';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';

// ============================================================================
// Types
// ============================================================================

interface CCSummaryParams {
  costCenterId: string;
  costCenterLabel: string;
  fromDate: string;
  toDate: string;
}

interface CCSummaryRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  classification: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

interface CCSummaryMeta {
  costCenterId: string;
  costCenterCode: string;
  costCenterName: string;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
}

const ALL_COLUMNS = [
  { id: 'index', label: '#', permanent: true },
  { id: 'accountCode', label: 'Account Code', sortable: true },
  { id: 'accountName', label: 'Account Name', sortable: true },
  { id: 'classification', label: 'Classification', sortable: true },
  { id: 'totalDebit', label: 'Total Debit', sortable: true },
  { id: 'totalCredit', label: 'Total Credit', sortable: true },
  { id: 'netBalance', label: 'Net Balance', permanent: true },
];

// ============================================================================
// Initiator
// ============================================================================

const CCSummaryInitiator: React.FC<{
  onSubmit: (params: CCSummaryParams) => void;
  initialParams?: CCSummaryParams | null;
  isModal?: boolean;
}> = ({ onSubmit, initialParams }) => {
  const [costCenterId, setCostCenterId] = useState(initialParams?.costCenterId || '');
  const [costCenterLabel, setCostCenterLabel] = useState(initialParams?.costCenterLabel || '');
  const [fromDate, setFromDate] = useState(() => {
    if (initialParams?.fromDate) return initialParams.fromDate;
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => initialParams?.toDate || new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costCenterId) return;
    onSubmit({ costCenterId, costCenterLabel, fromDate, toDate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Cost Center <span className="text-red-500">*</span>
          </label>
          <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }}>
            <CostCenterSelector
              value={costCenterId}
              onChange={(cc) => {
                if (cc) { setCostCenterId(cc.id); setCostCenterLabel(`${cc.code} - ${cc.name}`); }
                else { setCostCenterId(''); setCostCenterLabel(''); }
              }}
              placeholder="Select cost center..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" />
        </div>
      </div>
      <div className="flex justify-start pt-6 border-t border-slate-100">
        <Button type="submit" disabled={!costCenterId} className="bg-slate-900 hover:bg-black text-white px-10 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
          Execute Analysis
        </Button>
      </div>
    </form>
  );
};

// ============================================================================
// Report Content
// ============================================================================

const CCSummaryContent: React.FC<{
  params: CCSummaryParams;
  pagination?: any;
  setTotalItems?: (n: number) => void;
  visibleColumns?: string[];
  density?: 'compact' | 'comfortable';
}> = ({ params, setTotalItems, visibleColumns, density }) => {
  const [rows, setRows] = useState<CCSummaryRow[]>([]);
  const [meta, setMeta] = useState<CCSummaryMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const isCompact = density === 'compact';

  const vis = visibleColumns || ALL_COLUMNS.map(c => c.id);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await accountingApi.getCostCenterSummary(params.costCenterId, params.fromDate, params.toDate);
        const data = response.data || response || [];
        const responseMeta = response.meta || null;
        setRows(Array.isArray(data) ? data : []);
        setMeta(responseMeta);
        if (setTotalItems) setTotalItems(Array.isArray(data) ? data.length : 0);
      } catch (error) {
        console.error('Cost Center Summary error:', error);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.costCenterId, params.fromDate, params.toDate]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Processing...</p>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2 });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header Info Bar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-8 text-xs print:text-[9px]">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Cost Center</span>
          <span className="font-bold text-slate-900">{params.costCenterLabel || meta?.costCenterCode}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Period</span>
          <span className="font-mono text-slate-700">{params.fromDate}</span>
          <span className="mx-1 text-slate-400">→</span>
          <span className="font-mono text-slate-700">{params.toDate}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-2">Entries</span>
          <span className="font-bold text-slate-900">{rows.length}</span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-900 text-white">
              {vis.includes('index') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-left text-[9px] font-black uppercase tracking-widest w-10`}>#</th>}
              {vis.includes('accountCode') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-left text-[9px] font-black uppercase tracking-widest`}>Account Code</th>}
              {vis.includes('accountName') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-left text-[9px] font-black uppercase tracking-widest`}>Account Name</th>}
              {vis.includes('classification') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-left text-[9px] font-black uppercase tracking-widest`}>Classification</th>}
              {vis.includes('totalDebit') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-right text-[9px] font-black uppercase tracking-widest`}>Total Debit</th>}
              {vis.includes('totalCredit') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-right text-[9px] font-black uppercase tracking-widest`}>Total Credit</th>}
              {vis.includes('netBalance') && <th className={`px-3 ${isCompact ? 'py-1' : 'py-2'} text-right text-[9px] font-black uppercase tracking-widest bg-slate-800`}>Net Balance</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={vis.length} className="px-6 py-12 text-center text-slate-400">
                  <p className="text-sm font-bold mb-1">No entries found</p>
                  <p className="text-xs">No ledger entries match the selected cost center and date range.</p>
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={row.accountId} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  {vis.includes('index') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-slate-300 font-mono text-[10px] border-r border-slate-100`}>{idx + 1}</td>}
                  {vis.includes('accountCode') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} font-mono font-bold text-slate-900 border-r border-slate-100`}>{row.accountCode}</td>}
                  {vis.includes('accountName') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-slate-600 truncate border-r border-slate-100`}>{row.accountName}</td>}
                  {vis.includes('classification') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-slate-400 text-[10px] uppercase tracking-wider border-r border-slate-100`}>{row.classification || '--'}</td>}
                  {vis.includes('totalDebit') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-right font-mono font-bold border-r border-slate-100`}>{row.totalDebit > 0 ? fmt(row.totalDebit) : ''}</td>}
                  {vis.includes('totalCredit') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-right font-mono font-bold text-rose-700 border-r border-slate-100`}>{row.totalCredit > 0 ? fmt(row.totalCredit) : ''}</td>}
                  {vis.includes('netBalance') && (
                    <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1.5'} text-right font-mono font-black bg-slate-50/50 ${row.netBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                      {fmt(row.netBalance)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      {meta && (
        <div className="shrink-0 bg-white border-t border-slate-300 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] grid grid-cols-2 md:grid-cols-5 items-center z-10">
          <div className="md:col-span-2 p-4 flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {meta.costCenterCode} — {meta.costCenterName}
            </span>
          </div>
          <div className="p-4 border-l border-slate-100 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Total Debit</span>
            <span className="font-mono text-sm font-black text-slate-900 tabular-nums">{fmt(meta.totalDebit)}</span>
          </div>
          <div className="p-4 border-l border-slate-100 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Total Credit</span>
            <span className="font-mono text-sm font-black text-slate-900 tabular-nums">{fmt(meta.totalCredit)}</span>
          </div>
          <div className="p-4 border-l border-slate-300 bg-slate-50 text-right shadow-inner">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block leading-none mb-1">Net Balance</span>
            <span className={`font-mono text-base font-black tabular-nums ${meta.netBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              {fmt(meta.netBalance)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Page Export
// ============================================================================

export default function CostCenterSummaryPage() {
  return (
    <ReportContainer<CCSummaryParams>
      title="Cost Center Summary"
      subtitle="Breakdown of accounts by cost center"
      initiator={CCSummaryInitiator}
      ReportContent={CCSummaryContent}
      config={{
        paginated: false,
        availableColumns: ALL_COLUMNS,
      }}
    />
  );
}
