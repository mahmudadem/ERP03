import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { QuoteDTO, QuoteStatus, salesOperationalApi } from '../../../api/salesOperationalApi';
import { Plus, FileText, Search } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<QuoteStatus, string> = {
  DRAFT: 'border-slate-200 text-slate-500 bg-slate-50',
  SENT: 'border-blue-200 text-blue-600 bg-blue-50',
  ACCEPTED: 'border-green-200 text-green-600 bg-green-50',
  REJECTED: 'border-red-200 text-red-600 bg-red-50',
  EXPIRED: 'border-amber-200 text-amber-600 bg-amber-50',
  CONVERTED: 'border-violet-200 text-violet-600 bg-violet-50',
};

const StatusBadge: React.FC<{ status: QuoteStatus }> = ({ status }) => (
  <span
    className={clsx(
      'text-[9px] font-black px-2 py-0.5 rounded-full border tracking-widest uppercase',
      STATUS_STYLES[status] ?? 'border-slate-200 text-slate-400 bg-slate-50'
    )}
  >
    {status}
  </span>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<QuoteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await salesOperationalApi.listQuotes({ limit: 500 });
      setQuotes(Array.isArray(result) ? result : []);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    return dateStr.slice(0, 10);
  };

  const formatAmount = (amount: number, currency: string): string =>
    `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex-none p-6 border-b bg-white dark:bg-slate-900 shadow-sm relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-100 dark:shadow-none">
              <FileText size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                Quotations
              </h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.15em]">
                Sales Quotes & Proposals
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales/quotes/new')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md transition-all uppercase tracking-widest"
          >
            <Plus size={16} /> New Quote
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card className="p-0 overflow-hidden border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
            <div className="bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Search size={14} /> Quotation Directory
              </div>
              {loading && (
                <div className="text-[10px] text-blue-500 font-black animate-pulse uppercase tracking-tighter">
                  Loading...
                </div>
              )}
            </div>

            <div className="p-6">
              {quotes.length === 0 && !loading ? (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex p-6 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300">
                    <FileText size={48} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">No Quotations Found</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                      Create your first quotation by clicking the button above.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => navigate(`/sales/quotes/${q.id}`)}
                      className="group flex items-center justify-between py-3 px-2 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-all cursor-pointer rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors">
                          <FileText size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              {q.quoteNumber}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              v{q.version}
                            </span>
                            <StatusBadge status={q.status} />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {q.customerName}
                            {q.validUntil && (
                              <span className="ml-2">· Valid until {formatDate(q.validUntil)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {formatAmount(q.grandTotalDoc, q.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QuotationsPage;
