/**
 * PosCancelledReceiptsReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

interface CancelledReceiptRow {
  id: string;
  receiptNumber: string;
  registerId: string;
  shiftId: string;
  customerId: string;
  grandTotal: number;
  salesInvoiceNumber?: string;
  createdBy: string;
  createdAt: string;
  status: 'VOIDED';
}

const money = (value: number): string =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PosCancelledReceiptsReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<CancelledReceiptRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getCancelledReceiptsReport({ dateFrom: params.dateFrom, dateTo: params.dateTo, limit: 500 })
        .then((data) => {
          if (!cancelled) {
            const nextRows = (data || []) as CancelledReceiptRow[];
            setRows(nextRows);
            setTotalItems?.(nextRows.length);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, [params.dateFrom, params.dateTo, setTotalItems]);

    if (loading) return <div className="p-6 text-sm text-slate-500">...</div>;
    if (!rows.length) return <div className="p-6 text-sm text-slate-500">{t('common.empty', { defaultValue: 'No rows.' })}</div>;

    return (
      <div className="p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="px-2 py-2">Receipt</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Register</th>
              <th className="px-2 py-2">Cashier</th>
              <th className="px-2 py-2 text-right">Original total</th>
              <th className="px-2 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">
                  <div className="font-mono text-xs">{row.receiptNumber}</div>
                  <div className="font-mono text-xs text-slate-500">{row.salesInvoiceNumber || '-'}</div>
                </td>
                <td className="px-2 py-1.5">
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                    {row.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.registerId}</td>
                <td className="px-2 py-1.5 font-mono text-xs">{row.createdBy}</td>
                <td className="px-2 py-1.5 text-right font-mono">{money(row.grandTotal)}</td>
                <td className="px-2 py-1.5 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos.report.cancelledReceipts.title', { defaultValue: 'Cancelled Receipts' })}
      subtitle={t('pos.report.cancelledReceipts.subtitle', { defaultValue: 'Posted POS receipts marked voided after reversal through the return path.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosCancelledReceiptsReportPage;
