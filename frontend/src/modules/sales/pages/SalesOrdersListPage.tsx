import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SOStatus, SalesOrderDTO, salesApi } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: SOStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Delivered', value: 'PARTIALLY_DELIVERED' },
  { label: 'Fully Delivered', value: 'FULLY_DELIVERED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const SalesOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<SOStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await salesApi.listSOs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 200,
      });

      const list = unwrap<SalesOrderDTO[]>(result);
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load sales orders', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales orders.'
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusSummary = useMemo(() => {
    return STATUS_OPTIONS.filter((status) => status.value !== 'ALL').map((status) => ({
      label: status.label,
      value: orders.filter((order) => order.status === status.value).length,
    }));
  }, [orders]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Orders</h1>
          <p className="text-sm text-slate-600">Commercial sales commitments (no inventory/GL effects from SO itself).</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SOStatus | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            onClick={() => navigate('/sales/orders/new')}
          >
            New SO
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statusSummary.map((summary) => (
          <Card key={summary.label} className="p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">{summary.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{summary.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Order #</th>
                <th className="py-2 text-left">Customer</th>
                <th className="py-2 text-left">Order Date</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-left">Currency</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/sales/orders/${order.id}`)}
                >
                  <td className="py-2 font-medium">{order.orderNumber}</td>
                  <td className="py-2">{order.customerName}</td>
                  <td className="py-2">{order.orderDate}</td>
                  <td className="py-2 text-right">{formatMoney(order.grandTotalDoc, order.currency)}</td>
                  <td className="py-2">{order.currency}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{order.status}</span>
                  </td>
                </tr>
              ))}

              {!loading && orders.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    No sales orders found.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    Loading sales orders...
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

export default SalesOrdersListPage;
