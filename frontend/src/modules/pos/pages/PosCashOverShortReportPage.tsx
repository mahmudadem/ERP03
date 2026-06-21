/**
 * PosCashOverShortReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

const PosCashOverShortReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getCashOverShort({ dateFrom: params.dateFrom, dateTo: params.dateTo })
        .then((d) => { if (!cancelled) { setRows(d || []); setTotalItems?.((d || []).length); } })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [params.dateFrom, params.dateTo]);
    if (loading) return <div className="p-6 text-sm text-slate-500">…</div>;
    if (!rows.length) return <div className="p-6 text-sm text-slate-500">{t('common.empty', { defaultValue: 'No rows.' })}</div>;
    return (
      <div className="p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b">
              <th className="py-2 px-2">Shift</th>
              <th className="py-2 px-2">Register</th>
              <th className="py-2 px-2">Cashier</th>
              <th className="py-2 px-2">Closed</th>
              <th className="py-2 px-2 text-right">Expected</th>
              <th className="py-2 px-2 text-right">Counted</th>
              <th className="py-2 px-2 text-right">Variance</th>
              <th className="py-2 px-2">Voucher</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1.5 px-2 font-mono text-xs">{r.shiftId?.slice(-8)}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{r.registerId}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{r.cashierUserId?.slice(0, 8)}</td>
                <td className="py-1.5 px-2 text-xs">{r.closedAt ? new Date(r.closedAt).toLocaleString() : '—'}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.expectedCash).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono">{r.countedCash != null ? Number(r.countedCash).toFixed(2) : '—'}</td>
                <td className={`py-1.5 px-2 text-right font-mono ${Number(r.overShortAmount) > 0 ? 'text-emerald-700' : Number(r.overShortAmount) < 0 ? 'text-rose-700' : ''}`}>
                  {Number(r.overShortAmount).toFixed(2)}
                </td>
                <td className="py-1.5 px-2 font-mono text-xs">{r.overShortVoucherId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos.report.overShort.title', { defaultValue: 'Cash Over/Short' })}
      subtitle={t('pos.report.overShort.subtitle', { defaultValue: 'Per-shift variance and voucher link.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosCashOverShortReportPage;
