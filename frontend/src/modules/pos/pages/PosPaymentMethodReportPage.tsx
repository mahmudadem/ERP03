/**
 * PosPaymentMethodReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

const PosPaymentMethodReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getPaymentMethodSummary({ dateFrom: params.dateFrom, dateTo: params.dateTo })
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
              <th className="py-2 px-2">{t('pos:report.col.method')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.receipts')}</th>
              <th className="py-2 px-2 text-right">{t('pos:report.col.amount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="py-1.5 px-2 font-mono">{r.method}</td>
                <td className="py-1.5 px-2 text-right">{r.receiptCount}</td>
                <td className="py-1.5 px-2 text-right font-mono">{Number(r.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos:report.payments.title', { defaultValue: 'Payment Methods' })}
      subtitle={t('pos:report.payments.subtitle', { defaultValue: 'Receipts and amounts per POS payment method.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosPaymentMethodReportPage;
