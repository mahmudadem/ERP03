import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { accountingApi } from '../../../api/accountingApi';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { RefreshCw, Printer, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exportToExcel, exportElementToPDF } from '../../../utils/exportUtils';
import { DatePicker } from '../components/shared/DatePicker';

const JournalPage: React.FC = () => {
  const { t } = useTranslation('accounting');
  const { settings } = useCompanySettings();
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState<string>(() => `${new Date().getFullYear()}-01-01`);
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [voucherType, setVoucherType] = useState<string>('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { fromDate, toDate };
      if (voucherType) params.voucherType = voucherType;
      const result = await accountingApi.getJournal(params);
      setData(result || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    return data.reduce(
      (acc, v) => {
        acc.debit += v.totalDebit || 0;
        acc.credit += v.totalCredit || 0;
        return acc;
      },
      { debit: 0, credit: 0 }
    );
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t('journal.title')}</h1>
          <p className="text-sm text-slate-600">{t('journal.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const rows: any[] = [];
              data.forEach((v) =>
                v.lines.forEach((l: any) =>
                  rows.push({
                    date: v.date,
                    voucherNo: v.voucherNo,
                    account: l.accountCode,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit
                  })
                )
              );
              exportToExcel(
                rows,
                [
                  { header: t('journal.date'), key: 'date' },
                  { header: t('journal.voucher'), key: 'voucherNo' },
                  { header: t('journal.account'), key: 'account' },
                  { header: t('journal.description'), key: 'description' },
                  { header: t('journal.debit'), key: 'debit', isNumber: true },
                  { header: t('journal.credit'), key: 'credit', isNumber: true }
                ],
                `Journal-${fromDate}-${toDate}`,
                t('journal.title'),
                t('journal.period', { from: fromDate, to: toDate })
              );
            }}
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"
          >
            {t('common.exportExcel')}
          </button>
          <button
            onClick={() => exportElementToPDF('journal-report', 'Journal')}
            className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm"
          >
            {t('common.exportPDF')}
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border rounded-md text-sm">
            <Printer className="w-4 h-4" /> {t('common.print')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end bg-white border rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('journal.from')}</label>
          <DatePicker value={fromDate} onChange={setFromDate} className="w-36" />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('journal.to')}</label>
          <DatePicker value={toDate} onChange={setToDate} className="w-36" />
        </div>
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-muted)]">{t('journal.voucherType')}</label>
          <input
            type="text"
            value={voucherType}
            onChange={(e) => setVoucherType(e.target.value.toUpperCase())}
            className="border rounded px-2 py-1 text-sm"
            placeholder={t('journal.voucherTypePlaceholder')}
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-md text-sm"
          disabled={loading}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          {t('common.apply')}
        </button>
      </div>

      <div className="space-y-4" id="journal-report">
        {loading ? (
          <div className="text-sm text-slate-500">{t('common.loading')}</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-slate-500">{t('journal.empty')}</div>
        ) : (
          data.map((v) => (
            <div key={v.voucherId} className="bg-white border rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-sm font-semibold">
                    {t('journal.dateLabel', { date: formatCompanyDate(v.date, settings) })} &nbsp; · &nbsp; {t('journal.voucherLabel')}{" "}
                    <button className="text-indigo-600 font-bold" onClick={() => navigate(`/accounting/vouchers/${v.voucherId}`)}>
                      {v.voucherNo}
                    </button>
                    &nbsp; · &nbsp; {t('journal.type')}: {v.type}
                  </div>
                  <div className="text-xs text-slate-500">{t('journal.descriptionLabel')}: {v.description || '—'}</div>
                </div>
                <div className="text-xs uppercase font-bold text-slate-600">{v.status}</div>
              </div>

              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2">{t('journal.account')}</th>
                    <th className="py-2">{t('journal.description')}</th>
                    <th className="py-2 text-right">{t('journal.debit')}</th>
                    <th className="py-2 text-right">{t('journal.credit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {v.lines.map((l: any, idx: number) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-1">
                        <div className="font-semibold">{l.accountCode}</div>
                        <div className="text-xs text-slate-500">{l.accountName}</div>
                      </td>
                      <td className="py-1 text-slate-700">{l.description || '—'}</td>
                      <td className="py-1 text-right font-mono">{l.debit ? l.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                      <td className="py-1 text-right font-mono">{l.credit ? l.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end gap-6 mt-2 text-sm font-bold">
                <span>{t('journal.debitTotal')}: {v.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                <span>{t('journal.creditTotal')}: {v.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && data.length > 0 && (
        <div className="bg-white border rounded-xl p-4 shadow-sm flex justify-end gap-6 font-bold">
          <span>{t('journal.debitTotal')}: {totals.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          <span>{t('journal.creditTotal')}: {totals.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      )}
    </div>
  );
};

export default JournalPage;
