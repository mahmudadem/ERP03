import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PaymentStatus,
  SalesInvoiceDTO,
  salesApi,
  SIStatus,
} from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: SIStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PAYMENT_OPTIONS: Array<{ label: string; value: PaymentStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
];

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const SalesInvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<SIStatus | 'ALL'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceResult, customerResult] = await Promise.all([
        salesApi.listSIs({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
          customerId: customerFilter === 'ALL' ? undefined : customerFilter,
          limit: 200,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);

      const invoiceList = unwrap<SalesInvoiceDTO[]>(invoiceResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch (err: any) {
      console.error('Failed to load sales invoices', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales invoices.'
      );
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, paymentFilter, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Invoices</h1>
          <p className="text-sm text-slate-600">Post invoices to recognize revenue and receivables.</p>
        </div>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => navigate('/sales/invoices/new')}
        >
          New Invoice
        </button>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SIStatus | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'ALL')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {PAYMENT_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All Customers</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
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
                <th className="py-2 text-left">Invoice #</th>
                <th className="py-2 text-left">Customer</th>
                <th className="py-2 text-left">Invoice Date</th>
                <th className="py-2 text-right">Grand Total</th>
                <th className="py-2 text-left">Payment</th>
                <th className="py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/sales/invoices/${invoice.id}`)}
                >
                  <td className="py-2 font-medium">{invoice.invoiceNumber}</td>
                  <td className="py-2">{customerById[invoice.customerId] || invoice.customerName}</td>
                  <td className="py-2">{invoice.invoiceDate}</td>
                  <td className="py-2 text-right">{formatMoney(invoice.grandTotalDoc, invoice.currency)}</td>
                  <td className="py-2">{invoice.paymentStatus}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{invoice.status}</span>
                  </td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    No sales invoices found.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={6}>
                    Loading sales invoices...
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

export default SalesInvoicesListPage;
