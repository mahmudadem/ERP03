/**
 * PosDailySummaryReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

const PosDailySummaryReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void; visibleColumns?: string[]; density?: 'compact' | 'comfortable' }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getDailySummary({ dateFrom: params.dateFrom, dateTo: params.dateTo })
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
              <th className="py-2 px-2">{t('pos:report.col.date')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.receipts')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.returnCount')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.gross')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.returns')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.net')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1.5 px-2 font-mono">{r.date}</td>
                <td className="py-1.5 px-2 text-right">{r.receiptCount}</td>
                <td className="py-1.5 px-2 text-right">{r.returnCount}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.grossTotal).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.returnsTotal).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.netTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos:report.daily.title', { defaultValue: 'Daily POS Summary' })}
      subtitle={t('pos:report.daily.subtitle', { defaultValue: 'Receipts and returns per day.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosDailySummaryReportPage;
