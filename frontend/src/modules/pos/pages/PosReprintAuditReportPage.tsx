/**
 * PosReprintAuditReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { sortReportRowsByDateTimeDesc } from '../../../components/reports/reportSorting';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

interface ReprintAuditRow {
  receiptId: string;
  receiptNumber?: string;
  action: 'REPRINT';
  reprintedAt: string;
  cashierUserId: string;
  cashierUserEmail?: string;
  managerOverrideId?: string;
}

const PosReprintAuditReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<ReprintAuditRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getReprintAuditReport({ dateFrom: params.dateFrom, dateTo: params.dateTo, limit: 500 })
        .then((data) => {
          if (!cancelled) {
            const nextRows = sortReportRowsByDateTimeDesc((data || []) as ReprintAuditRow[], ['reprintedAt', 'createdAt']);
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
              <th className="px-2 py-2">{t('pos:report.col.time')}</th>
              <th className="px-2 py-2">{t('pos:report.col.receipt')}</th>
              <th className="px-2 py-2">{t('pos:report.col.action')}</th>
              <th className="px-2 py-2">{t('pos:report.col.cashier')}</th>
              <th className="px-2 py-2">{t('pos:report.col.managerOverride')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.receiptId}-${row.reprintedAt}-${index}`} className="border-b last:border-b-0">
                <td className="px-2 py-1.5 text-xs text-slate-500">{new Date(row.reprintedAt).toLocaleString()}</td>
                <td className="px-2 py-1.5 font-mono">{row.receiptNumber || row.receiptId}</td>
                <td className="px-2 py-1.5">
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                    {row.action}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="font-mono text-xs text-slate-700">{row.cashierUserId}</div>
                  {row.cashierUserEmail ? <div className="text-xs text-slate-500">{row.cashierUserEmail}</div> : null}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-slate-500">{row.managerOverrideId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos:report.reprintAudit.title', { defaultValue: 'Reprint Audit' })}
      subtitle={t('pos:report.reprintAudit.subtitle', { defaultValue: 'Receipt reprint events for duplicate-copy control.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosReprintAuditReportPage;
