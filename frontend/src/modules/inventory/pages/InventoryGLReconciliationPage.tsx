import React, { useEffect, useState } from 'react';
import { ChevronRight, CheckCircle2, AlertTriangle, Scale } from 'lucide-react';
import { inventoryApi, InventoryGLReconciliationDTO } from '../../../api/inventoryApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { Spinner } from '../../../components/ui/Spinner';
import { useTranslation } from 'react-i18next';

interface GLReconParams {
  asOfDate: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Initiator ────────────────────────────────────────────────────────────────

const Initiator: React.FC<{
  onSubmit: (p: GLReconParams) => void;
  initialParams?: GLReconParams | null;
}> = ({ onSubmit, initialParams }) => {
  const { t } = useTranslation('common');
  const [asOfDate, setAsOfDate] = useState(initialParams?.asOfDate || today());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ asOfDate });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
        <div className="md:col-span-4 space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            {t('inventory.glReconciliation.filters.asOfDate', { defaultValue: 'As Of Date' })}
          </label>
          <DatePicker value={asOfDate} onChange={setAsOfDate} className="w-full" />
        </div>
        <div className="md:col-span-8 text-xs text-slate-500 italic">
          {t('inventory.glReconciliation.help', {
            defaultValue: "Compares the inventory sub-ledger (Σ qty × avg cost, grouped by each item's Inventory Asset account) against the General Ledger balance of those accounts. Any difference is costing/posting drift.",
          })}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" className="bg-slate-900 hover:bg-black text-white px-10 py-3 rounded-xl shadow-lg shadow-slate-900/10 hover:shadow-xl transition-all">
          <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest">
            {t('common.generate', { defaultValue: 'Generate Report' })}
            <ChevronRight className="w-4 h-4" />
          </span>
        </Button>
      </div>
    </form>
  );
};

// ─── ReportContent ──────────────────────────────────────────────────────────

const ReportContent: React.FC<{
  params: GLReconParams;
  density?: 'compact' | 'comfortable';
}> = ({ params, density }) => {
  const { t } = useTranslation('common');
  const [data, setData] = useState<InventoryGLReconciliationDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    inventoryApi
      .getGLReconciliation(params.asOfDate)
      .then((res) => {
        if (cancelled) return;
        setData((res as any)?.data ?? res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.error?.message || err?.message || t('inventory.glReconciliation.loadFailed', { defaultValue: 'Failed to load reconciliation' }));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [params.asOfDate]);

  const cellPad = density === 'compact' ? 'py-1.5 px-3' : 'py-2.5 px-4';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex-1 min-h-0 overflow-auto p-6 space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>}

        {loading ? (
          <div className="bg-white border rounded-xl p-6 shadow-sm flex items-center justify-center min-h-[180px]">
            <div className="text-center">
              <Spinner size="lg" variant="slate" className="mx-auto mb-3" />
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t('inventory.glReconciliation.reconciling', { defaultValue: 'Reconciling…' })}</p>
            </div>
          </div>
        ) : data ? (
          <>
            <div
              className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${
                data.isReconciled
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              {data.isReconciled ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              <div>
                <div className="text-sm font-black uppercase tracking-wide">
                  {data.isReconciled
                    ? t('inventory.glReconciliation.status.ties', { defaultValue: 'Inventory ties to the GL' })
                    : t('inventory.glReconciliation.status.driftDetected', { defaultValue: 'Drift detected between stock and GL' })}
                </div>
                <div className="text-xs">
                  {t('inventory.glReconciliation.summary.asOf', { defaultValue: 'As of' })} {data.asOfDate} · {t('inventory.glReconciliation.summary.stockValue', { defaultValue: 'Stock value' })} {fmt(data.totalStockValueBase)} · {t('inventory.glReconciliation.summary.glBalance', { defaultValue: 'GL balance' })} {fmt(data.totalGLBalanceBase)} · {t('inventory.glReconciliation.summary.difference', { defaultValue: 'Difference' })}{' '}
                  <span className="font-bold">{fmt(data.totalDifferenceBase)}</span>
                  {data.unmappedStockValueBase !== 0 && (
                    <> · {t('inventory.glReconciliation.summary.unmappedStockValue', { defaultValue: 'Unmapped stock value' })} {fmt(data.unmappedStockValueBase)}</>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-200">
                  <tr>
                    <th className={`${cellPad} text-left`}>{t('inventory.glReconciliation.columns.account', { defaultValue: 'Account' })}</th>
                    <th className={`${cellPad} text-left`}>{t('inventory.glReconciliation.columns.name', { defaultValue: 'Name' })}</th>
                    <th className={`${cellPad} text-right`}>{t('inventory.glReconciliation.columns.stockValueBase', { defaultValue: 'Stock Value (Base)' })}</th>
                    <th className={`${cellPad} text-right`}>{t('inventory.glReconciliation.columns.glBalanceBase', { defaultValue: 'GL Balance (Base)' })}</th>
                    <th className={`${cellPad} text-right`}>{t('inventory.glReconciliation.columns.difference', { defaultValue: 'Difference' })}</th>
                    <th className={`${cellPad} text-center`}>{t('inventory.glReconciliation.columns.status', { defaultValue: 'Status' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.accountId} className={`border-t border-slate-100 ${line.matched ? '' : 'bg-amber-50/50'}`}>
                      <td className={`${cellPad} font-mono text-slate-600`}>{line.accountCode}</td>
                      <td className={cellPad}>{line.accountName || '—'}</td>
                      <td className={`${cellPad} text-right tabular-nums`}>{fmt(line.stockValueBase)}</td>
                      <td className={`${cellPad} text-right tabular-nums`}>{fmt(line.glBalanceBase)}</td>
                      <td className={`${cellPad} text-right tabular-nums font-bold ${line.matched ? 'text-slate-500' : 'text-amber-700'}`}>
                        {fmt(line.differenceBase)}
                      </td>
                      <td className={`${cellPad} text-center`}>
                        {line.matched ? (
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">{t('inventory.glReconciliation.status.matched', { defaultValue: 'Matched' })}</span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{t('inventory.glReconciliation.status.drift', { defaultValue: 'Drift' })}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.lines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        <Scale className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        {t('inventory.glReconciliation.empty', { defaultValue: 'No inventory asset accounts with stock value or GL balance.' })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

const InventoryGLReconciliationPage: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <ReportContainer<GLReconParams>
      title={t('inventory.glReconciliation.title', { defaultValue: 'Inventory ↔ GL Reconciliation' })}
      subtitle={t('inventory.glReconciliation.subtitle', { defaultValue: 'Stock sub-ledger value vs General Ledger inventory balances' })}
      initiator={Initiator}
      ReportContent={ReportContent}
      config={{ paginated: false }}
    />
  );
};

export default InventoryGLReconciliationPage;
