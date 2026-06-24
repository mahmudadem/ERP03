/**
 * PosTopSellingItemsReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

interface TopSellingItemRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  qtySold: number;
  grossSales: number;
  receiptCount: number;
}

const money = (value: number): string =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PosTopSellingItemsReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<TopSellingItemRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getTopSellingItemsReport({ dateFrom: params.dateFrom, dateTo: params.dateTo, limit: 100 })
        .then((data) => {
          if (!cancelled) {
            const nextRows = (data || []) as TopSellingItemRow[];
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
              <th className="px-2 py-2">{t('pos:report.col.item')}</th>
              <th className="px-2 py-2 text-right">{t('pos:report.col.qtySold')}</th>
              <th className="px-2 py-2 text-right">{t('pos:report.col.grossSales')}</th>
              <th className="px-2 py-2 text-right">{t('pos:report.col.receipts')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.itemId} className="border-b last:border-b-0">
                <td className="px-2 py-1.5">
                  <div className="font-medium text-slate-900">{row.itemName}</div>
                  <div className="font-mono text-xs text-slate-500">{row.itemCode}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{row.qtySold}</td>
                <td className="px-2 py-1.5 text-right font-mono">{money(row.grossSales)}</td>
                <td className="px-2 py-1.5 text-right font-mono">{row.receiptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos:report.topSellingItems.title', { defaultValue: 'Top Selling Items' })}
      subtitle={t('pos:report.topSellingItems.subtitle', { defaultValue: 'Gross sold quantity and amount from completed POS receipts.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosTopSellingItemsReportPage;
