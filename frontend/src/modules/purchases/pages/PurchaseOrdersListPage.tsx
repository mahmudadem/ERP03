import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POStatus, PurchaseOrderDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: POStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
  { label: 'Fully Received', value: 'FULLY_RECEIVED' },
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

const PurchaseOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrderDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<POStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await purchasesApi.listPOs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        limit: 200,
      });

      const list = unwrap<PurchaseOrderDTO[]>(result);
      setOrders(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to load purchase orders', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase orders.'
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
    return STATUS_OPTIONS.filter((s) => s.value !== 'ALL').map((status) => ({
      label: status.label,
      value: orders.filter((order) => order.status === status.value).length,
    }));
  }, [orders]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Orders</h1>
          <p className="text-sm text-slate-600">Commercial purchase commitments only (no stock/GL effects in Phase 1).</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as POStatus | 'ALL')}
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
            onClick={() => navigate('/purchases/orders/new')}
          >
            New PO
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
                <th className="py-2 text-left">Vendor</th>
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
                  onClick={() => navigate(`/purchases/orders/${order.id}`)}
                >
                  <td className="py-2 font-medium">{order.orderNumber}</td>
                  <td className="py-2">{order.vendorName}</td>
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
                    No purchase orders found.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    Loading purchase orders...
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

export default PurchaseOrdersListPage;
