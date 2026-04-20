import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { InventoryItemDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  CreateSalesOrderPayload,
  DeliveryNoteDTO,
  SalesInvoiceDTO,
  SalesOrderDTO,
  SalesOrderLineInputDTO,
  SalesReturnDTO,
  SOStatus,
  salesApi,
  UpdateSalesOrderPayload,
} from '../../../api/salesApi';
import { PartyDTO, TaxCodeDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { CurrencySelector } from '../../accounting/components/shared/CurrencySelector';
import { CurrencyExchangeWidget } from '../../accounting/components/shared/CurrencyExchangeWidget';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  orderedQty: number;
  uomId?: string;
  uom: string;
  unitPriceDoc: number;
  taxCodeId?: string;
  warehouseId?: string;
  description?: string;
  deliveredQty: number;
  invoicedQty: number;
  returnedQty: number;
}

interface EditableForm {
  id?: string;
  orderNumber?: string;
  status: SOStatus;
  customerId: string;
  customerName?: string;
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
  uomId: undefined,
  uom: '',
  unitPriceDoc: 0,
  taxCodeId: undefined,
  warehouseId: undefined,
  description: '',
  deliveredQty: 0,
  invoicedQty: 0,
  returnedQty: 0,
});

const createEmptyForm = (): EditableForm => ({
  status: 'DRAFT',
  customerId: '',
  orderDate: todayIso(),
  expectedDeliveryDate: '',
  currency: 'USD',
  exchangeRate: 1,
  notes: '',
  internalNotes: '',
  lines: [createEmptyLine()],
});

const statusBadgeClass = (status: SOStatus): string => {
  if (status === 'DRAFT') return 'bg-slate-100 text-slate-700';
  if (status === 'CONFIRMED') return 'bg-blue-100 text-blue-700';
  if (status === 'PARTIALLY_DELIVERED') return 'bg-amber-100 text-amber-700';
  if (status === 'FULLY_DELIVERED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'CLOSED') return 'bg-emerald-100 text-emerald-700';
  return 'bg-rose-100 text-rose-700';
};

const SalesOrderDetailPage: React.FC = () => {
  const { company } = useCompanyAccess();
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const isCreateMode = !params.id || params.id === 'new';

  const [form, setForm] = useState<EditableForm>(createEmptyForm());
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCodeDTO[]>([]);
  const [linkedDNs, setLinkedDNs] = useState<DeliveryNoteDTO[]>([]);
  const [linkedSIs, setLinkedSIs] = useState<SalesInvoiceDTO[]>([]);
  const [linkedSRs, setLinkedSRs] = useState<SalesReturnDTO[]>([]);
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const salesTaxCodes = useMemo(
    () => taxCodes.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH'),
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

  const toEditableForm = (so: SalesOrderDTO): EditableForm => ({
    id: so.id,
    orderNumber: so.orderNumber,
    status: so.status,
    customerId: so.customerId,
    customerName: so.customerName,
    orderDate: so.orderDate,
    expectedDeliveryDate: so.expectedDeliveryDate || '',
    currency: so.currency,
    exchangeRate: so.exchangeRate,
    notes: so.notes || '',
    internalNotes: so.internalNotes || '',
    lines: so.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      orderedQty: line.orderedQty,
      uomId: line.uomId,
      uom: line.uom,
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId,
      warehouseId: line.warehouseId,
      description: line.description,
      deliveredQty: line.deliveredQty,
      invoicedQty: line.invoicedQty,
      returnedQty: line.returnedQty,
    })),
  });

  const loadReferenceData = async () => {
    const [customerResult, itemResult, taxResult] = await Promise.all([
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      sharedApi.listTaxCodes({ active: true }),
    ]);

    const customerList = unwrap<PartyDTO[]>(customerResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const taxCodeList = unwrap<TaxCodeDTO[]>(taxResult);

    setCustomers(Array.isArray(customerList) ? customerList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setTaxCodes(Array.isArray(taxCodeList) ? taxCodeList : []);
  };

  const ensureItemUomOptions = async (itemId: string) => {
    if (!itemId || uomOptionsByItemId[itemId] || !itemById[itemId]) return;
    try {
      const result = await inventoryApi.listUomConversions(itemId);
      const conversions = unwrap<UomConversionDTO[]>(result) || [];
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], conversions),
      }));
    } catch (error) {
      console.error('Failed to load UOM conversions', error);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadOrder = async (id: string): Promise<SalesOrderDTO> => {
    const result = await salesApi.getSO(id);
    const so = unwrap<SalesOrderDTO>(result);
    setForm(toEditableForm(so));
    return so;
  };

  const loadRelatedDocuments = async (salesOrderId: string) => {
    const [dnResult, siResult, srResult] = await Promise.all([
      salesApi.listDNs({ salesOrderId, limit: 200 }),
      salesApi.listSIs({ salesOrderId, limit: 200 }),
      salesApi.listReturns({}),
    ]);

    const dns = unwrap<DeliveryNoteDTO[]>(dnResult);
    const sis = unwrap<SalesInvoiceDTO[]>(siResult);
    const allReturns = unwrap<SalesReturnDTO[]>(srResult);

    const uniqueReturns = Array.from(
      new Map((Array.isArray(allReturns) ? allReturns : []).map((entry) => [entry.id, entry])).values()
    ).filter((entry) => entry.salesOrderId === salesOrderId);

    setLinkedDNs(Array.isArray(dns) ? dns : []);
    setLinkedSIs(Array.isArray(sis) ? sis : []);
    setLinkedSRs(uniqueReturns);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await loadReferenceData();

      if (isCreateMode) {
        setForm(createEmptyForm());
      } else if (params.id) {
        await loadOrder(params.id);
        await loadRelatedDocuments(params.id);
      }
    } catch (err: any) {
      console.error('Failed to load sales order detail', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales order.'
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
  const canDeliverGoods = Boolean(form.id) && ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(form.status);
  const canCreateInvoice = Boolean(form.id)
    && ['CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED', 'CLOSED'].includes(form.status);
  const deliverGoodsHref = form.id
    ? `/sales/delivery-notes/new?salesOrderId=${encodeURIComponent(form.id)}&customerId=${encodeURIComponent(form.customerId)}`
    : '';
  const createInvoiceHref = form.id
    ? `/sales/invoices/new?salesOrderId=${encodeURIComponent(form.id)}&customerId=${encodeURIComponent(form.customerId)}`
    : '';

  const setLine = (index: number, patch: Partial<EditableLine>) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      const current = lines[index];
      const next: EditableLine = { ...current, ...patch };

      if (patch.itemId !== undefined) {
        const item = itemById[patch.itemId];
        if (item) {
          const defaultUom = getDefaultItemUomOption(item, 'sales');
          next.itemCode = item.code;
          next.itemName = item.name;
          next.uomId = next.uomId || defaultUom?.uomId;
          next.uom = next.uom || defaultUom?.code || item.salesUom || item.baseUom;
          if (!next.taxCodeId && item.defaultSalesTaxCodeId) {
            const defaultTax = salesTaxCodes.find((taxCode) => taxCode.id === item.defaultSalesTaxCodeId);
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
    if (!form.customerId) return 'Customer is required.';
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

  const buildLinePayload = (line: EditableLine, index: number): SalesOrderLineInputDTO => {
    const item = itemById[line.itemId];
    return {
      lineId: line.lineId,
      lineNo: index + 1,
      itemId: line.itemId,
      orderedQty: line.orderedQty,
      uomId: line.uomId,
      uom: line.uom || item?.salesUom || item?.baseUom || 'EA',
      unitPriceDoc: line.unitPriceDoc,
      taxCodeId: line.taxCodeId || undefined,
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
  };

  const saveOrder = async (): Promise<SalesOrderDTO | null> => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return null;
    }

    try {
      setSaving(true);
      setError(null);

      const payloadBase = {
        customerId: form.customerId,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        currency: form.currency.toUpperCase(),
        exchangeRate: form.exchangeRate,
        lines: form.lines.map((line, index) => buildLinePayload(line, index)),
        notes: form.notes || undefined,
        internalNotes: form.internalNotes || undefined,
      };

      let saved: SalesOrderDTO;
      if (isCreateMode || !form.id) {
        const created = await salesApi.createSO(payloadBase as CreateSalesOrderPayload);
        saved = unwrap<SalesOrderDTO>(created);
        navigate(`/sales/orders/${saved.id}`, { replace: true });
      } else {
        const updated = await salesApi.updateSO(form.id, payloadBase as UpdateSalesOrderPayload);
        saved = unwrap<SalesOrderDTO>(updated);
      }

      setForm(toEditableForm(saved));
      return saved;
    } catch (err: any) {
      console.error('Failed to save sales order', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save sales order.'
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
      console.error('Sales order action failed', err);
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

      const result = await salesApi.confirmSO(currentId);
      setForm(toEditableForm(unwrap<SalesOrderDTO>(result)));
    });
  };

  const cancelOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await salesApi.cancelSO(form.id as string);
      setForm(toEditableForm(unwrap<SalesOrderDTO>(result)));
    });
  };

  const closeOrder = async () => {
    if (!form.id) return;
    await withBusyAction(async () => {
      const result = await salesApi.closeSO(form.id as string);
      setForm(toEditableForm(unwrap<SalesOrderDTO>(result)));
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Order</h1>
        <Card className="p-6">Loading sales order...</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {form.orderNumber || 'New Sales Order'}
          </h1>
          <p className="text-sm text-slate-600">Commercial sales document. Inventory and accounting effects occur in later documents.</p>
        </div>
        <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(form.status)}`}>
          {form.status}
        </span>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card className="p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer</label>
            <PartySelector 
              value={form.customerId}
              disabled={isReadOnly}
              onChange={(party) => {
                setForm((prev) => ({
                  ...prev,
                  customerId: party?.id || '',
                  customerName: party?.displayName || '',
                  currency: party?.defaultCurrency || prev.currency,
                }));
              }}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Order Date</label>
            <DatePicker 
              value={form.orderDate}
              disabled={isReadOnly}
              onChange={(val) => setForm((prev) => ({ ...prev, orderDate: val }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Expected Delivery</label>
            <DatePicker 
              value={form.expectedDeliveryDate}
              disabled={isReadOnly}
              onChange={(val) => setForm((prev) => ({ ...prev, expectedDeliveryDate: val }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
            <CurrencySelector
              value={form.currency}
              onChange={(code) => setForm((prev) => ({ ...prev, currency: code }))}
              disabled={isReadOnly || saving || actionBusy}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Exchange Rate</label>
            <CurrencyExchangeWidget
              currency={form.currency}
              baseCurrency={company?.baseCurrency || 'USD'}
              voucherDate={form.orderDate}
              value={form.exchangeRate}
              onChange={(rate) => setForm((prev) => ({ ...prev, exchangeRate: rate }))}
              disabled={isReadOnly || saving || actionBusy}
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
                    <select
                      className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 uppercase"
                      value={findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId || line.uomId || line.uom}
                      disabled={isReadOnly || !line.itemId}
                      onChange={(e) => {
                        const selected = (uomOptionsByItemId[line.itemId] || []).find((option) => (option.uomId || option.code) === e.target.value);
                        setLine(index, { uomId: selected?.uomId, uom: selected?.code || '' });
                      }}
                    >
                      <option value="">{line.itemId ? 'Select UOM' : 'No item'}</option>
                      {(uomOptionsByItemId[line.itemId] || []).map((option) => (
                        <option key={option.uomId || option.code} value={option.uomId || option.code}>
                          {option.code}
                        </option>
                      ))}
                    </select>
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
                      {salesTaxCodes.map((taxCode) => (
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
                    Del: {line.deliveredQty} / Inv: {line.invoicedQty} / Ret: {line.returnedQty}
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Customer Notes</label>
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

      <Card className="p-5">
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Linked Documents</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery Notes</div>
            <div className="space-y-2">
              {linkedDNs.map((dn) => (
                <button
                  key={dn.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => navigate(`/sales/delivery-notes/${dn.id}`)}
                >
                  <span className="text-sm font-medium">{dn.dnNumber}</span>
                  <span className="text-xs text-slate-500">{dn.status}</span>
                </button>
              ))}
              {!linkedDNs.length && <div className="text-sm text-slate-500">No linked delivery notes.</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sales Invoices</div>
            <div className="space-y-2">
              {linkedSIs.map((si) => (
                <button
                  key={si.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => navigate(`/sales/invoices/${si.id}`)}
                >
                  <span className="text-sm font-medium">{si.invoiceNumber}</span>
                  <span className="text-xs text-slate-500">{si.status}</span>
                </button>
              ))}
              {!linkedSIs.length && <div className="text-sm text-slate-500">No linked sales invoices.</div>}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Sales Returns</div>
            <div className="space-y-2">
              {linkedSRs.map((sr) => (
                <button
                  key={sr.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => navigate(`/sales/returns/${sr.id}`)}
                >
                  <span className="text-sm font-medium">{sr.returnNumber}</span>
                  <span className="text-xs text-slate-500">{sr.status}</span>
                </button>
              ))}
              {!linkedSRs.length && <div className="text-sm text-slate-500">No linked sales returns.</div>}
            </div>
          </div>
        </div>
      </Card>

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
          </div>
        )}

        {isConfirmed && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(deliverGoodsHref)}
              disabled={!canDeliverGoods}
            >
              Deliver Goods
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(createInvoiceHref)}
              disabled={!canCreateInvoice}
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

        {(form.status === 'PARTIALLY_DELIVERED' || form.status === 'FULLY_DELIVERED') && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(deliverGoodsHref)}
              disabled={!canDeliverGoods}
            >
              Deliver Goods
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => navigate(createInvoiceHref)}
              disabled={!canCreateInvoice}
            >
              Create Invoice
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

        {(form.status === 'CLOSED' || form.status === 'CANCELLED') && (
          <div className="text-sm text-slate-500">This sales order is read-only in status: {form.status}.</div>
        )}
      </Card>
    </div>
  );
};

export default SalesOrderDetailPage;
