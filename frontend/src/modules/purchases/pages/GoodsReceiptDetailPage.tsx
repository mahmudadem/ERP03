import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateGRNPayload,
  GoodsReceiptDTO,
  PurchaseInvoiceDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const GoodsReceiptDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const [grn, setGrn] = useState<GoodsReceiptDTO | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState(searchParams.get('purchaseOrderId') || '');
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') || '');
  const [receiptDate, setReceiptDate] = useState(todayIso());
  const [warehouseId, setWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLinkedInvoiceLine, setHasLinkedInvoiceLine] = useState(false);

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

      const [settingsResult, warehouseResult] = await Promise.all([
        purchasesApi.getSettings(),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
      ]);

      const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);
      const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
      setSettings(currentSettings);
      setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);

      if (!warehouseId && currentSettings?.defaultWarehouseId) {
        setWarehouseId(currentSettings.defaultWarehouseId);
      }

      if (!isCreateMode && params.id) {
        const result = await purchasesApi.getGRN(params.id);
        const loaded = unwrap<GoodsReceiptDTO>(result);
        setGrn(loaded);
        setPurchaseOrderId(loaded.purchaseOrderId || '');
        setReceiptDate(loaded.receiptDate);
        setWarehouseId(loaded.warehouseId);
        setNotes(loaded.notes || '');

        if (loaded.purchaseOrderId) {
          const invoicesResult = await purchasesApi.listPIs({
            purchaseOrderId: loaded.purchaseOrderId,
            limit: 200,
          });
          const invoices = unwrap<PurchaseInvoiceDTO[]>(invoicesResult);
          const grnLineIdSet = new Set(loaded.lines.map((line) => line.lineId));
          const linked = (Array.isArray(invoices) ? invoices : []).some((invoice) =>
            invoice.lines.some((line) => line.grnLineId && grnLineIdSet.has(line.grnLineId))
          );
          setHasLinkedInvoiceLine(linked);
        } else {
          setHasLinkedInvoiceLine(false);
        }
      } else {
        setGrn(null);
        setHasLinkedInvoiceLine(false);
      }
    } catch (err: any) {
      console.error('Failed to load goods receipt detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load goods receipt.'
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

      if (!receiptDate) {
        setError('Receipt date is required.');
        return;
      }
      if (!warehouseId) {
        setError('Warehouse is required.');
        return;
      }

      const payload: CreateGRNPayload = {
        purchaseOrderId: purchaseOrderId || undefined,
        vendorId: vendorId || undefined,
        receiptDate,
        warehouseId,
        notes: notes || undefined,
      };

      const created = await purchasesApi.createGRN(payload);
      const dto = unwrap<GoodsReceiptDTO>(created);
      navigate(`/purchases/goods-receipts/${dto.id}`, { replace: true });
    } catch (err: any) {
      console.error('Failed to create goods receipt', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to create draft GRN.'
      );
    } finally {
      setBusy(false);
    }
  };

  const postDraft = async () => {
    if (!grn?.id) return;
    try {
      setBusy(true);
      setError(null);
      const posted = await purchasesApi.postGRN(grn.id);
      setGrn(unwrap<GoodsReceiptDTO>(posted));
    } catch (err: any) {
      console.error('Failed to post goods receipt', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to post goods receipt.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipt</h1>
        <Card className="p-6">Loading goods receipt...</Card>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">New Goods Receipt</h1>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            onClick={() => navigate('/purchases/goods-receipts')}
          >
            Back to List
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">PO Reference (Optional in SIMPLE)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={purchaseOrderId}
                onChange={(e) => setPurchaseOrderId(e.target.value)}
                placeholder="purchaseOrderId"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor (Standalone only)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                placeholder="vendorId"
                disabled={!!purchaseOrderId}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Receipt Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
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
          <div className="mt-4 text-xs text-slate-500">
            If PO is provided, lines are pre-filled from open stock lines using server-side rules.
          </div>
        </Card>

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={createDraft}
            disabled={busy}
          >
            {busy ? 'Creating...' : 'Create Draft GRN'}
          </button>
        </div>
      </div>
    );
  }

  if (!grn) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Goods Receipt</h1>
        <Card className="p-6 text-sm text-red-700">Goods receipt not found.</Card>
      </div>
    );
  }

  const canCreateReturn = grn.status === 'POSTED'
    && settings?.procurementControlMode === 'CONTROLLED'
    && !hasLinkedInvoiceLine;
  const createReturnHref = `/purchases/returns/new?goodsReceiptId=${encodeURIComponent(grn.id)}${
    grn.purchaseOrderId ? `&purchaseOrderId=${encodeURIComponent(grn.purchaseOrderId)}` : ''
  }`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{grn.grnNumber}</h1>
          <p className="text-sm text-slate-600">
            Vendor: <span className="font-medium">{grn.vendorName}</span>
            {grn.purchaseOrderId ? ` • PO: ${grn.purchaseOrderId}` : ''}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
          {grn.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Receipt Date</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">{grn.receiptDate}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Warehouse</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {warehouseLabelById[grn.warehouseId] || grn.warehouseId}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Created</div>
            <div className="mt-1 font-medium text-slate-900 dark:text-slate-100">
              {new Date(grn.createdAt).toLocaleString()}
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
                <th className="py-2 text-right">Received Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Cost</th>
                <th className="py-2 text-left">Currency</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((line) => (
                <tr key={line.lineId} className="border-b border-slate-100">
                  <td className="py-2">{line.itemCode ? `${line.itemCode} - ${line.itemName}` : line.itemName}</td>
                  <td className="py-2 text-right">{line.receivedQty}</td>
                  <td className="py-2">{line.uom}</td>
                  <td className="py-2 text-right">{line.unitCostDoc.toFixed(2)}</td>
                  <td className="py-2">{line.moveCurrency}</td>
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
          onClick={() => navigate('/purchases/goods-receipts')}
        >
          Back to List
        </button>
        {grn.status === 'DRAFT' && (
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={postDraft}
            disabled={busy}
          >
            {busy ? 'Posting...' : 'Post GRN'}
          </button>
        )}
        {grn.status === 'POSTED' && (
          <button
            type="button"
            className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => navigate(createReturnHref)}
            disabled={!canCreateReturn}
          >
            Create Return
          </button>
        )}
      </div>
    </div>
  );
};

export default GoodsReceiptDetailPage;
