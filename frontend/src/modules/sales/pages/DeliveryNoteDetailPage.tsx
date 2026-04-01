import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { DeliveryNoteDTO, salesApi, SalesSettingsDTO } from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const DeliveryNoteDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNoteDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);

  const [salesOrderId, setSalesOrderId] = useState(searchParams.get('salesOrderId') || '');
  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [deliveryDate, setDeliveryDate] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [settingsResult, warehouseResult, customersResult] = await Promise.all([
        salesApi.getSettings(),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);

      const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
      const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
      const customerList = unwrap<PartyDTO[]>(customersResult);

      setSettings(currentSettings);
      setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);

      if (!warehouseId && currentSettings?.defaultWarehouseId) {
        setWarehouseId(currentSettings.defaultWarehouseId);
      }

      if (!isCreateMode && params.id) {
        const result = await salesApi.getDN(params.id);
        const loaded = unwrap<DeliveryNoteDTO>(result);
        setDeliveryNote(loaded);
      } else {
        setDeliveryNote(null);
      }
    } catch (err: any) {
      console.error('Failed to load delivery note detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load delivery note.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createDraft = async () => {
    try {
      setBusy(true);
      setError(null);

      if (!deliveryDate) {
        setError('Delivery date is required.');
        return;
      }
      if (!warehouseId) {
        setError('Warehouse is required.');
        return;
      }
      if (!salesOrderId && !customerId) {
        setError('Customer is required when sales order is not provided.');
        return;
      }

      const created = await salesApi.createDN({
        salesOrderId: salesOrderId || undefined,
        customerId: salesOrderId ? undefined : customerId || undefined,
        deliveryDate,
        warehouseId,
        notes: notes || undefined,
      });

      const dto = unwrap<DeliveryNoteDTO>(created);
      navigate(`/sales/delivery-notes/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create delivery note', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create delivery note draft.'
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async () => {
    if (!deliveryNote?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await salesApi.postDN(deliveryNote.id);
      setDeliveryNote(unwrap<DeliveryNoteDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post delivery note', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post delivery note.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Delivery Note</h1>
        <Card className="p-6">Loading delivery note...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Delivery Note</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/sales/delivery-notes')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales Order ID (optional in SIMPLE)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={salesOrderId}
                onChange={(e) => setSalesOrderId(e.target.value)}
                placeholder="salesOrderId"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer (standalone)</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={customerId}
                disabled={!!salesOrderId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="">Select warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} - {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {settings?.salesControlMode === 'CONTROLLED' && !salesOrderId && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              CONTROLLED mode requires a sales order when creating delivery notes.
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            When salesOrderId is provided, lines are pre-filled by server rules.
          </div>
        </Card>

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy}
        >
          {busy ? 'Creating...' : 'Create Draft Delivery Note'}
        </button>
      </div>
    );
  }

  if (!deliveryNote) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Delivery Note</h1>
        <Card className="p-6 text-sm text-red-700">Delivery note not found.</Card>
      </div>
    );
  }

  const canCreateReturn = deliveryNote.status === 'POSTED' && settings?.salesControlMode === 'CONTROLLED';
  const createReturnHref = `/sales/returns/new?deliveryNoteId=${encodeURIComponent(deliveryNote.id)}${deliveryNote.salesOrderId ? `&salesOrderId=${encodeURIComponent(deliveryNote.salesOrderId)}` : ''}`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{deliveryNote.dnNumber}</h1>
          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium">{deliveryNote.customerName}</span>
            {deliveryNote.salesOrderId ? ` • SO: ${deliveryNote.salesOrderId}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {deliveryNote.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Delivery Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{deliveryNote.deliveryDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[deliveryNote.warehouseId] || deliveryNote.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Created</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {new Date(deliveryNote.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Lines</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Delivered Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Cost (Base)</th>
                <th className="py-2 text-right">Line Cost (Base)</th>
              </tr>
            </thead>
            <tbody>
              {deliveryNote.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.deliveredQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostBase.toFixed(2)}</td>
                  <td className="py-2 text-right">{line.lineCostBase.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          onClick={() => navigate('/sales/delivery-notes')}
        >
          Back to List
        </button>
        {deliveryNote.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post Delivery Note'}
          </button>
        )}
        {canCreateReturn && (
          <button
            type="button"
            className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700"
            onClick={() => navigate(createReturnHref)}
          >
            Create Return
          </button>
        )}
      </div>
    </div>
  );
};

export default DeliveryNoteDetailPage;
