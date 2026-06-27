import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { AgedBacklogRowDTO, salesOperationalApi } from '../../../api/salesOperationalApi';
import { AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from "react-i18next";

const AgedBacklogPage: React.FC = () => {
    const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [rows, setRows] = useState<AgedBacklogRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await salesOperationalApi.getAgedBacklog();
      setRows(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Failed to load aged backlog', err);
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load aged backlog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-rose-600 rounded-xl text-white shadow-lg shadow-rose-100 dark:shadow-none">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{t(`Aged Backlog`)}</h1>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">{t(`Overdue Orders Past Promised Delivery Date`)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t(`Overdue Orders`)}</div>
              {loading && <div className="text-[10px] text-rose-500 font-black animate-pulse uppercase tracking-tighter">{t(`Loading...`)}</div>}
            </div>

            <div className="p-6">
              {rows.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-full text-emerald-400">
                    <AlertTriangle size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{t(`No overdue orders — all deliveries on schedule.`)}</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        {['Order Number', 'Customer', 'Promised Date', 'Days Overdue', 'Grand Total (Base)', 'Status'].map((h) => (
                          <th
                            key={h}
                            className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3 pr-4"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.salesOrderId}
                          className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 cursor-pointer transition-all"
                          onClick={() => navigate(`/sales/orders/${row.salesOrderId}`)}
                        >
                          <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{row.orderNumber}</td>
                          <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{row.customerName}</td>
                          <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{row.promisedDate}</td>
                          <td className="py-3 pr-4">
                            <span
                              className={clsx(
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border tracking-widest uppercase',
                                row.daysOverdue > 7
                                  ? 'bg-red-50 text-red-600 border-red-200'
                                  : 'bg-amber-50 text-amber-600 border-amber-200'
                              )}
                            >
                              {row.daysOverdue}d
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-mono text-slate-700 dark:text-slate-300">
                            {row.grandTotalBase.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{row.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AgedBacklogPage;
