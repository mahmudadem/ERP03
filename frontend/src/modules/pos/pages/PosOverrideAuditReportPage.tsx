/**
 * PosOverrideAuditReportPage.tsx
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { posApi } from '../../../api/posApi';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { PosDateRangeInitiator, PosDateRangeParams } from './PosDateRangeInitiator';

interface OverrideAuditRow {
  receiptId: string;
  receiptNumber: string;
  registerId: string;
  shiftId: string;
  cashierUserId: string;
  createdAt: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  eventType: 'VOID_LINE' | 'PRICE_OVERRIDE' | 'DISCOUNT_OVERRIDE' | 'TAX_OVERRIDE';
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: number;
  lineDiscount: number;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  managerOverrideId?: string;
}

const money = (value: number): string =>
  Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const eventLabel = (eventType: OverrideAuditRow['eventType']): string => {
  switch (eventType) {
    case 'VOID_LINE': return 'Void line';
    case 'PRICE_OVERRIDE': return 'Price override';
    case 'DISCOUNT_OVERRIDE': return 'Discount override';
    case 'TAX_OVERRIDE': return 'Tax override';
    default: return eventType;
  }
};

const PosOverrideAuditReportPage: React.FC<{ isWindow?: boolean }> = ({ isWindow }) => {
  const { t } = useTranslation();

  const Content: React.FC<{ params: PosDateRangeParams; setTotalItems?: (n: number) => void }> = ({ params, setTotalItems }) => {
    const [rows, setRows] = useState<OverrideAuditRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      posApi.getOverrideAuditReport({ dateFrom: params.dateFrom, dateTo: params.dateTo })
        .then((data) => {
          if (!cancelled) {
            const nextRows = (data || []) as OverrideAuditRow[];
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
    if (!rows.length) {
      return (
        <div className="p-6 text-sm text-slate-500">
          {t('common.empty', { defaultValue: 'No rows.' })}
        </div>
      );
    }

    return (
      <div className="p-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-slate-500">
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Receipt</th>
              <th className="px-2 py-2">Event</th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Line total</th>
              <th className="px-2 py-2">Reason / value</th>
              <th className="px-2 py-2">Override</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.receiptId}-${row.itemCode}-${row.eventType}-${index}`} className="border-b last:border-b-0">
                <td className="px-2 py-1.5 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-2 py-1.5 font-mono">{row.receiptNumber}</td>
                <td className="px-2 py-1.5">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {eventLabel(row.eventType)}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="font-medium text-slate-900">{row.itemName}</div>
                  <div className="font-mono text-xs text-slate-500">{row.itemCode}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{row.qty}</td>
                <td className="px-2 py-1.5 text-right font-mono">{money(row.lineTotal)}</td>
                <td className="px-2 py-1.5 text-xs text-slate-600">
                  {row.eventType === 'VOID_LINE'
                    ? row.voidReason || '-'
                    : row.eventType === 'DISCOUNT_OVERRIDE'
                      ? `${row.discountType || ''} ${row.discountValue ?? ''} (${money(row.lineDiscount)})`
                      : `${money(row.unitPrice)}`}
                </td>
                <td className="px-2 py-1.5 font-mono text-xs text-slate-500">
                  {row.managerOverrideId || row.voidedBy || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <ReportContainer<PosDateRangeParams>
      title={t('pos.report.overrideAudit.title', { defaultValue: 'Override Audit' })}
      subtitle={t('pos.report.overrideAudit.subtitle', { defaultValue: 'Voids, manual discounts, price overrides, and tax overrides for manager review.' })}
      isWindow={isWindow}
      initiator={PosDateRangeInitiator}
      ReportContent={Content}
    />
  );
};

export default PosOverrideAuditReportPage;
