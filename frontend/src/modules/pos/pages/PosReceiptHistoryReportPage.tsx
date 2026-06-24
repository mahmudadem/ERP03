/**
 * PosReceiptHistoryReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

const PosReceiptHistoryReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void; density?: 'compact' | 'comfortable'; visibleColumns?: string[] }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getReceiptHistoryReport({ dateFrom: params.dateFrom, dateTo: params.dateTo, limit: 500 })
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
              <th className="py-2 px-2">{t('pos:report.col.receipt')}</th>
              <th className="py-2 px-2">{t('pos:report.col.si')}</th>
              <th className="py-2 px-2">{t('pos:report.col.register')}</th>
              <th className="py-2 px-2">{t('pos:report.col.customer')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.total')}</th>
              <th className="py-2 px-2">{t('pos:report.col.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1.5 px-2 font-mono text-xs">{r.receiptNumber}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{r.salesInvoiceNumber || '—'}</td>
                <td className="py-1.5 px-2 font-mono text-xs">{r.registerId}</td>
                <td className="py-1.5 px-2 text-xs">{r.customerId?.slice(-6)}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.grandTotal).toFixed(2)}</td>
                <td className="py-1.5 px-2 text-xs">{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos:report.receipts.title', { defaultValue: 'Receipt History' })}
      subtitle={t('pos:report.receipts.subtitle', { defaultValue: 'All POS receipts in the period, with the linked SI number.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosReceiptHistoryReportPage;
