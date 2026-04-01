import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InventoryItemDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreatePurchaseOrderPayload,
  GoodsReceiptDTO,
  POStatus,
  PurchaseInvoiceDTO,
  PurchaseOrderDTO,
  PurchaseOrderLineInputDTO,
  PurchaseReturnDTO,
  purchasesApi,
  UpdatePurchaseOrderPayload,
} from '../../../api/purchasesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  orderedQty: number;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
  receivedQty: number;
  invoicedQty: number;
  returnedQty: number;
}

interface EditableForm {
  id?: string;
  orderNumber?: string;
  status: POStatus;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDeliveryDate: string;
  currency: string;
  exchangeRate: number;
  notes: string;
  internalNotes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  orderedQty: 1,
  uom: '',
  unitPriceDoc: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
  receivedQty: 0,
  invoicedQty: 0,
  returnedQty: 0,
});

const createEmptyForm = (): EditableForm => ({
  status: 'DRAFT',
  vendorId: '',
  orderDate: todayIso(),
  expectedDeliveryDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  internalNotes: '',
  lines: [createEmptyLine()],
});

const statusBadgeClass = (status: POStatus): string => {
  if (status === 'DRAFT') return 'bg-slate-100 text-slate-700';
  if (status === 'CONFIRMED') return 'bg-blue-100 text-blue-700';
  if (status === 'PARTIALLY_RECEIVED') return 'bg-amber-100 text-amber-700';
  if (status === 'FULLY_RECEIVED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'CLOSED') return 'bg-emerald-100 text-emerald-700';
  return 'bg-rose-100 text-rose-700';
};

const PurchaseOrderDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isCreateMode = !params.id || params.id === 'new';

  const [form, setForm] = useState<EditableForm>(createEmptyForm());
  const [vendors, setVendors] = useState<PartyDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [relatedGRNs, setRelatedGRNs] = useState<GoodsReceiptDTO[]>([]);
  const [relatedPIs, setRelatedPIs] = useState<PurchaseInvoiceDTO[]>([]);
  const [relatedReturns, setRelatedReturns] = useState<PurchaseReturnDTO[]>([]);

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const taxById = useMemo(
    () =>
      taxCodes.reduce<Record<string, TaxCodeDTO>>((acc, taxCode) => {
        acc[taxCode.id] = taxCode;
        return acc;
      }, {}),
    [taxCodes]
  );

  const purchaseTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH'),
    [taxCodes]
  );

  const computedLines = useMemo(() => {
    return form.lines.map((line) => {
      const taxRate = line.taxCodeId ? taxById[line.taxCodeId]?.rate ?? 0 : 0;
      const lineTotalDoc = roundMoney((line.orderedQty || 0) * (line.unitPriceDoc || 0));
      const lineTotalBase = roundMoney(lineTotalDoc * (form.exchangeRate || 0));
      const taxAmountDoc = roundMoney(lineTotalDoc * taxRate);
      const taxAmountBase = roundMoney(lineTotalBase * taxRate);

      return {
        lineTotalDoc,
        lineTotalBase,
        taxAmountDoc,
        taxAmountBase,
      };
    });
  }, [form.exchangeRate, form.lines, taxById]);

  const totals = useMemo(() => {
    const subtotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
    const subtotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.lineTotalBase, 0));
    const taxTotalDoc = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    const taxTotalBase = roundMoney(computedLines.reduce((sum, line) => sum + line.taxAmountBase, 0));

    return {
      subtotalDoc,
      subtotalBase,
      taxTotalDoc,
      taxTotalBase,
      grandTotalDoc: roundMoney(subtotalDoc + taxTotalDoc),
      grandTotalBase: roundMoney(subtotalBase + taxTotalBase),
    };
  }, [computedLines]);

  const toEditableForm = (po: PurchaseOrderDTO): EditableForm => ({
    id: po.id,
    orderNumber: po.orderNumber,
    status: po.status,
    vendorId: po.vendorId,
    vendorName: po.vendorName,
    orderDate: po.orderDate,
    expectedDeliveryDate: po.expectedDeliveryDate || '',
    currency: po.currency,
    exchangeRate: po.exchangeRate,
    notes: po.notes || '',
    internalNotes: po.internalNotes || '',
    lines: po.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      orderedQty: line.orderedQty,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId,
      warehouseId: line.warehouseId,
      description: line.description,
      receivedQty: line.receivedQty,
      invoicedQty: line.invoicedQty,
      returnedQty: line.returnedQty,
    })),
  });

  const loadReferenceData = async () => {
    const [vendorResult, itemResult, taxResult] = await Promise.all([
      sharedApi.listParties({ role: 'VENDOR', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
    ]);

    const vendorList = unwrap<PartyDTO[]>(vendorResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);

    setVendors(Array.isArray(vendorList) ? vendorList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
  };

  const loadOrder = async (id: string) => {
    const result = await purchasesApi.getPO(id);
    const po = unwrap<PurchaseOrderDTO>(result);
    setForm(toEditableForm(po));
    await loadRelatedDocuments(id);
  };

  const loadRelatedDocuments = async (purchaseOrderId: string) => {
    const [grnResult, invoiceResult, returnResult] = await Promise.all([
      purchasesApi.listGRNs({ purchaseOrderId, limit: 200 }),
      purchasesApi.listPIs({ purchaseOrderId, limit: 200 }),
      purchasesApi.listReturns(),
    ]);

    const grns = unwrap<GoodsReceiptDTO[]>(grnResult);
    const invoices = unwrap<PurchaseInvoiceDTO[]>(invoiceResult);
    const returns = unwrap<PurchaseReturnDTO[]>(returnResult);

    setRelatedGRNs(Array.isArray(grns) ? grns : []);
    setRelatedPIs(Array.isArray(invoices) ? invoices : []);
    setRelatedReturns(
      (Array.isArray(returns) ? returns : []).filter((entry) => entry.purchaseOrderId === purchaseOrderId)
    );
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (isCreateMode) {
        setForm(createEmptyForm());
        setRelatedGRNs([]);
        setRelatedPIs([]);
        setRelatedReturns([]);
      } else if (params.id) {
        await loadOrder(params.id);
      }
    } catch (err: any) {
      console.error('Failed to load purchase order detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase order.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDraft = form.status === 'DRAFT';
  const isConfirmed = form.status === 'CONFIRMED';
  const isReadOnly = !isDraft;
  const downstreamActionQuery = form.id
    ? `purchaseOrderId=${encodeURIComponent(form.id)}&vendorId=${encodeURIComponent(form.vendorId || '')}`
    : '';

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uom = next.uom || item.purchaseUom || item.baseUom;
          if (!next.taxCodeId && item.defaultPurchaseTaxCodeId) {
            const defaultTax = purchaseTaxCodes.find((taxCode) => taxCode.id === item.defaultPurchaseTaxCodeId);
            if (defaultTax) next.taxCodeId = defaultTax.id;
          }
        }
      }

      lines[index] = next;
      return { ...prev, lines };
    });
  };

  const addLine = () => {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, createEmptyLine()] }));
  };

  const removeLine = (index: number) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      const nextLines = prev.lines.filter((_, idx) => idx !== index);
      return { ...prev, lines: nextLines };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.vendorId) return 'Vendor is required.';
    if (!form.orderDate) return 'Order date is required.';
    if (!form.currency.trim()) return 'Currency is required.';
    if (Number.isNaN(form.exchangeRate) || form.exchangeRate <= 0) return 'Exchange rate must be greater than 0.';
    if (!form.lines.length) return 'At least one line is required.';

    for (let i = 0; i < form.lines.length; i += 1) {
      const line = form.lines[i];
      if (!line.itemId) return `Line ${i + 1}: item is required.`;
      if (Number.isNaN(line.orderedQty) || line.orderedQty <= 0) return `Line ${i + 1}: quantity must be greater than 0.`;
      if (Number.isNaN(line.unitPriceDoc) || line.unitPriceDoc < 0) return `Line ${i + 1}: unit price must be greater than or equal to 0.`;
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): PurchaseOrderLineInputDTO => {
    const item = itemById[line.itemId];
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      itemId: line.itemId,
      orderedQty: line.orderedQty,
      uom: line.uom || item?.purchaseUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId || undefined,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
  };

  const saveOrder = async (): Promise<PurchaseOrderDTO | null> => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return null;
    }

    try {
      setSaving(true);
      setError(null);

      const payloadBase = {
        vendorId: form.vendorId,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
      };

      let saved: PurchaseOrderDTO;
      if (isCreateMode || !form.id) {
        const created = await purchasesApi.createPO(payloadBase as CreatePurchaseOrderPayload);
        saved = unwrap<PurchaseOrderDTO>(created);
        navigate(`/purchases/orders/${saved.id}`, { replace: true });
      } else {
        const updated = await purchasesApi.updatePO(form.id, payloadBase as UpdatePurchaseOrderPayload);
        saved = unwrap<PurchaseOrderDTO>(updated);
      }

      setForm(toEditableForm(saved));
      return saved;
    } catch (err: any) {
      console.error('Failed to save purchase order', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save purchase order.'
      );
      return null;
    } finally {
      setSaving(false);
    }
  };

  const withBusyAction = async (action: () => Promise<void>) => {
    try {
      setActionBusy(true);
      setError(null);
      await action();
    } catch (err: any) {
      console.error('Purchase order action failed', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Action failed.'
      );
    } finally {
      setActionBusy(false);
    }
  };

  const confirmOrder = async () => {
    await withBusyAction(async () => {
      let currentId = form.id;
      if (!currentId) {
        const saved = await saveOrder();
        if (!saved) return;
        currentId = saved.id;
      }

      const result = await purchasesApi.confirmPO(currentId);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const cancelOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await purchasesApi.cancelPO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const closeOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await purchasesApi.closePO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
    });
  };

  const deleteDraft = async () => {
    if (!form.id) {
      navigate('/purchases/orders');
      return;
    }

    await withBusyAction(async () => {
      const result = await purchasesApi.cancelPO(form.id as string);
      setForm(toEditableForm(unwrap<PurchaseOrderDTO>(result)));
      navigate('/purchases/orders');
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchase Order</h1>
        <Card className="p-6">Loading purchase order...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {form.orderNumber || 'New Purchase Order'}
          </h1>
          <p className="text-sm text-slate-600">Commercial document only. No inventory or accounting effects in Phase 1.</p>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(form.status)}`}>
          {form.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.vendorId}
              disabled={isReadOnly}
              onChange={(e) => {
                const nextVendorId = e.target.value;
                const vendor = vendors.find((entry) => entry.id === nextVendorId);
                setForm((prev) => ({
                  ...prev,
                  vendorId: nextVendorId,
                  vendorName: vendor?.displayName,
                  currency: vendor?.defaultCurrency || prev.currency,
                }));
              }}
            >
              <option value="">Select vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Order Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.orderDate}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, orderDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expected Delivery</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.expectedDeliveryDate}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, expectedDeliveryDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <input
              type="text"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
              value={form.currency}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exchange Rate</label>
            <input
              type="number"
              min={0.000001}
              step={0.000001}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.exchangeRate}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, exchangeRate: Number(e.target.value) }))}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line Items</h2>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={addLine}
            disabled={isReadOnly}
          >
            Add Line
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-left">UOM</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-left">Tax Code</th>
                <th className="py-2 text-right">Line Total</th>
                <th className="py-2 text-right">Tax</th>
                <th className="py-2 text-right">Line Base</th>
                <th className="py-2 text-left">Status Qty</th>
                <th className="py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => (
                <tr key={line.lineId || `line-${index}`} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2">
                    <select
                      className="w-52 rounded-lg border border-slate-300 px-2 py-1.5"
                      value={line.itemId}
                      disabled={isReadOnly}
                      onChange={(e) => setLine(index, { itemId: e.target.value })}
                    >
                      <option value="">Select item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                    {(line.itemCode || line.itemName) && (
                      <div className="mt-1 text-xs text-slate-500">
                        {(line.itemCode || '') + (line.itemName ? ` - ${line.itemName}` : '')}
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0.000001}
                      step={0.000001}
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                      value={line.orderedQty}
                      disabled={isReadOnly}
                      onChange={(e) => setLine(index, { orderedQty: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="text"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 uppercase"
                      value={line.uom}
                      disabled={isReadOnly}
                      onChange={(e) => setLine(index, { uom: e.target.value.toUpperCase() })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-right"
                      value={line.unitPriceDoc}
                      disabled={isReadOnly}
                      onChange={(e) => setLine(index, { unitPriceDoc: Number(e.target.value) })}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <select
                      className="w-40 rounded-lg border border-slate-300 px-2 py-1.5"
                      value={line.taxCodeId || ''}
                      disabled={isReadOnly}
                      onChange={(e) => setLine(index, { taxCodeId: e.target.value || undefined })}
                    >
                      <option value="">No Tax</option>
                      {purchaseTaxCodes.map((taxCode) => (
                        <option key={taxCode.id} value={taxCode.id}>
                          {taxCode.code} ({Math.round(taxCode.rate * 100)}%)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {form.currency} {computedLines[index]?.lineTotalDoc.toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {form.currency} {computedLines[index]?.taxAmountDoc.toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    {computedLines[index]?.lineTotalBase.toFixed(2)}
                  </td>
                  <td className="py-2 pr-2 text-xs text-slate-500">
                    Rec: {line.receivedQty} / Inv: {line.invoicedQty} / Ret: {line.returnedQty}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                      onClick={() => removeLine(index)}
                      disabled={isReadOnly || form.lines.length <= 1}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Vendor Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.notes}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Internal Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.internalNotes}
              disabled={isReadOnly}
              onChange={(e) => setForm((prev) => ({ ...prev, internalNotes: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Totals</h3>
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal ({form.currency})</span>
            <span className="font-medium">
              {form.currency} {totals.subtotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal (Base)</span>
            <span className="font-medium">{totals.subtotalBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax ({form.currency})</span>
            <span className="font-medium">
              {form.currency} {totals.taxTotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tax (Base)</span>
            <span className="font-medium">{totals.taxTotalBase.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total ({form.currency})</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {form.currency} {totals.grandTotalDoc.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Grand Total (Base)</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{totals.grandTotalBase.toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {!isCreateMode && form.id && (
        <Card className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Linked Documents</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Goods Receipts</div>
              <div className="space-y-2">
                {relatedGRNs.length === 0 && <div className="text-sm text-slate-500">No linked GRNs.</div>}
                {relatedGRNs.map((grn) => (
                  <button
                    key={grn.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/goods-receipts/${grn.id}`)}
                  >
                    {grn.grnNumber}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Purchase Invoices</div>
              <div className="space-y-2">
                {relatedPIs.length === 0 && <div className="text-sm text-slate-500">No linked invoices.</div>}
                {relatedPIs.map((invoice) => (
                  <button
                    key={invoice.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/invoices/${invoice.id}`)}
                  >
                    {invoice.invoiceNumber}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Purchase Returns</div>
              <div className="space-y-2">
                {relatedReturns.length === 0 && <div className="text-sm text-slate-500">No linked returns.</div>}
                {relatedReturns.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="block text-sm text-primary-700 hover:underline"
                    onClick={() => navigate(`/purchases/returns/${entry.id}`)}
                  >
                    {entry.returnNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={saveOrder}
              disabled={saving || actionBusy}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={confirmOrder}
              disabled={saving || actionBusy}
            >
              Confirm
            </button>
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
              onClick={deleteDraft}
              disabled={saving || actionBusy}
            >
              Delete
            </button>
          </div>
        )}

        {isConfirmed && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              onClick={() => navigate(`/purchases/goods-receipts/new?${downstreamActionQuery}`)}
              disabled={!form.id}
            >
              Receive Goods
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
              onClick={() => navigate(`/purchases/invoices/new?${downstreamActionQuery}`)}
              disabled={!form.id}
            >
              Create Invoice
            </button>
            <button
              type="button"
              className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
              onClick={cancelOrder}
              disabled={saving || actionBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={closeOrder}
              disabled={saving || actionBusy}
            >
              Close
            </button>
          </div>
        )}

        {!isDraft && !isConfirmed && (
          <div className="text-sm text-slate-500">This purchase order is read-only in status: {form.status}.</div>
        )}
      </Card>
    </div>
  );
};

export default PurchaseOrderDetailPage;
