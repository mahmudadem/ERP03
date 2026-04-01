import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReturnContext, SalesReturnDTO, salesApi, SRStatus } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: SRStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const CONTEXT_OPTIONS: Array<{ label: string; value: ReturnContext | 'ALL' }> = [
  { label: 'All Contexts', value: 'ALL' },
  { label: 'After Invoice', value: 'AFTER_INVOICE' },
  { label: 'Before Invoice', value: 'BEFORE_INVOICE' },
];

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const SalesReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<SRStatus | 'ALL'>('ALL');
  const [contextFilter, setContextFilter] = useState<ReturnContext | 'ALL'>('ALL');
  const [returns, setReturns] = useState<SalesReturnDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await salesApi.listReturns({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      const list = unwrap<SalesReturnDTO[]>(result);
      setReturns(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load sales returns', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || 'Failed to load sales returns.'
      );
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReturns = useMemo(() => {
    if (contextFilter === 'ALL') return returns;
    return returns.filter((entry) => entry.returnContext === contextFilter);
  }, [contextFilter, returns]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Returns</h1>
          <p className="text-sm text-slate-600">Track sales return documents posted before or after invoicing.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => navigate('/sales/returns/new')}
        >
          New Return
        </button>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SRStatus | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value as ReturnContext | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {CONTEXT_OPTIONS.map((context) => (
              <option key={context.value} value={context.value}>
                {context.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-4">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Return #</th>
                <th className="py-2 text-left">Customer</th>
                <th className="py-2 text-left">Return Date</th>
                <th className="py-2 text-left">Context</th>
                <th className="py-2 text-right">Grand Total</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredReturns.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/sales/returns/${entry.id}`)}
                >
                  <td className="py-2 font-medium">{entry.returnNumber}</td>
                  <td className="py-2">{entry.customerName}</td>
                  <td className="py-2">{entry.returnDate}</td>
                  <td className="py-2">{entry.returnContext}</td>
                  <td className="py-2 text-right">{formatMoney(entry.grandTotalDoc, entry.currency)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{entry.status}</span>
                  </td>
                </tr>
              ))}
              {!loading && filteredReturns.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    No sales returns found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    Loading sales returns...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SalesReturnsListPage;

