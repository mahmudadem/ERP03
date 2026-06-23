/**
 * PosZReportPage.tsx — Z Report (finalized close summary) for a specific shift.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { Button } from '../../../components/ui/Button';

interface ZParams { shiftId: string }

const PosZReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Initiator: React.FC<{ onSubmit: (p: ZParams) => void; initialParams?: ZParams | null }> = ({ onSubmit, initialParams }) => {
    const [shiftId, setShiftId] = useState(initialParams?.shiftId || '');
    return (
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit({ shiftId: shiftId.trim() }); }}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
          <div className="md:col-span-8 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {t('pos:report.z.shiftId', { defaultValue: 'Shift ID' })}
            </label>
            <input
              type="text"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="shift_…"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <Button
              type="submit"
              disabled={!shiftId.trim()}
              className="bg-slate-900 hover:bg-black text-white px-8 py-2.5 rounded-xl"
            >
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                {t('common.generate', { defaultValue: 'Generate' })} <ChevronRight className="w-4 h-4" />
              </span>
            </Button>
          </div>
        </div>
      </form>
    );
  };

  const Content: React.FC<{ params: ZParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [data, setData] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      posApi.getZReport(params.shiftId)
        .then((d) => { if (!cancelled) { setData(d); setTotalItems?.(1); } })
        .catch((err) => { if (!cancelled) setError(err?.response?.data?.error?.message || err?.message || 'Failed'); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [params.shiftId]);

    if (loading) return <div className="p-6 text-sm text-slate-500">{t('common.loading', { defaultValue: 'Loading…' })}</div>;
    if (error) return <div className="p-6 text-sm text-rose-600">{error}</div>;
    if (!data) return null;
    return (
      <div className="p-4 space-y-3 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label={t('pos:report.z.opening', { defaultValue: 'Opening float' })} value={data.shift.openingFloat} />
          <Stat label={t('pos:report.z.expected', { defaultValue: 'Expected cash' })} value={data.totals.expectedCash} />
          <Stat label={t('pos:report.z.gross', { defaultValue: 'Gross sales' })} value={data.grossTotal} />
          <Stat label={t('pos:report.z.returns', { defaultValue: 'Returns' })} value={data.returnsTotal} />
          <Stat label={t('pos:report.z.net', { defaultValue: 'Net sales' })} value={data.netTotal} />
          <Stat label={t('pos:report.z.receipts', { defaultValue: 'Receipts' })} value={String(data.receiptCount)} />
          <Stat label={t('pos:report.z.returnsCount', { defaultValue: 'Returns count' })} value={String(data.returnCount)} />
          <Stat label={t('pos:report.z.variance', { defaultValue: 'Over/short' })} value={data.shift.overShortAmount ?? 0} highlight={Number(data.shift.overShortAmount || 0) !== 0} />
        </div>
        {data.shift.overShortVoucherId && (
          <div className="text-xs text-slate-500">
            {t('pos:report.z.voucher', { defaultValue: 'Voucher' })}: <span className="font-mono">{data.shift.overShortVoucherId}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <ReportContainer<ZParams>
      title={t('pos:report.z.title', { defaultValue: 'Z Report (by shift)' })}
      subtitle={t('pos:report.z.subtitle', { defaultValue: 'Finalized close summary for a closed POS shift.' })}
      isWindow={isWindow}
      initiator={Initiator}
      ReportContent={Content}
      config={{ paginated: false }}
    />
  );
};

const Stat: React.FC<{ label: string; value: number | string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`p-3 rounded border ${highlight ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className="text-xs text-slate-500">{label}</div>
    <div className="font-mono text-lg font-semibold">
      {typeof value === 'number' ? value.toFixed(2) : value}
    </div>
  </div>
);

export default PosZReportPage;
