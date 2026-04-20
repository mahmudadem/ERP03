import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { InventoryItemDTO, InventoryWarehouseDTO, UomConversionDTO, inventoryApi } from '../../../api/inventoryApi';
import {
  DeliveryNoteDTO,
  DeliveryNoteLineInputDTO,
  SalesOrderDTO,
  salesApi,
  SalesSettingsDTO,
} from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { DatePicker } from '../../accounting/components/shared/DatePicker';
import { PartySelector } from '../../../components/shared/selectors';
import { buildItemUomOptions, findItemUomOption, getDefaultItemUomOption, ManagedUomOption } from '../../inventory/utils/uomOptions';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

interface EditableLine {
  lineId?: string;
  soLineId?: string;
  itemId: string;
  itemCode?: string;
  itemName?: string;
  deliveredQty: number;
  uomId?: string;
  uom: string;
  warehouseId?: string;
  description?: string;
}

interface EditableForm {
  salesOrderId: string;
  customerId: string;
  deliveryDate: string;
  warehouseId: string;
  notes: string;
  lines: EditableLine[];
}

const createEmptyLine = (): EditableLine => ({
  itemId: '',
  deliveredQty: 1,
  uomId: undefined,
  uom: '',
  warehouseId: undefined,
  description: '',
});

const createEmptyForm = (salesOrderId = '', customerId = '', warehouseId = ''): EditableForm => ({
  salesOrderId,
  customerId,
  deliveryDate: todayIso(),
  warehouseId,
  notes: '',
  lines: [createEmptyLine()],
});

const DeliveryNoteDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isCreateMode = !params.id || params.id === 'new';

  const initialSalesOrderId = searchParams.get('salesOrderId') || '';
  const initialCustomerId = searchParams.get('customerId') || '';

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNoteDTO | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [items, setItems] = useState<InventoryItemDTO[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDTO[]>([]);
  const [form, setForm] = useState<EditableForm>(() => createEmptyForm(initialSalesOrderId, initialCustomerId));
  const [uomOptionsByItemId, setUomOptionsByItemId] = useState<Record<string, ManagedUomOption[]>>({});

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orderLineLoading, setOrderLineLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warehouseLabelById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

  const itemById = useMemo(
    () =>
      items.reduce<Record<string, InventoryItemDTO>>((acc, item) => {
        acc[item.id] = item;
        return acc;
      }, {}),
    [items]
  );

  const salesOrderLabelById = useMemo(
    () =>
      salesOrders.reduce<Record<string, string>>((acc, order) => {
        acc[order.id] = `${order.orderNumber} - ${order.customerName}`;
        return acc;
      }, {}),
    [salesOrders]
  );

  const toEditableLinesFromSalesOrder = (so: SalesOrderDTO): EditableLine[] => {
    return so.lines
      .map((line) => {
        const remainingQty = Math.max(line.orderedQty - line.deliveredQty, 0);
        if (remainingQty <= 0) return null;

        return {
          soLineId: line.lineId,
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          deliveredQty: remainingQty,
          uomId: line.uomId,
          uom: line.uom,
          warehouseId: line.warehouseId,
          description: line.description,
        } as EditableLine;
      })
      .filter((line): line is EditableLine => line !== null);
  };

  const loadReferenceData = async () => {
    const [settingsResult, warehouseResult, customerResult, itemResult, salesOrderResult] = await Promise.all([
      salesApi.getSettings(),
      inventoryApi.listWarehouses({ active: true, limit: 200 }),
      sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      inventoryApi.listItems({ active: true, limit: 500 }),
      salesApi.listSOs({ limit: 500 }),
    ]);

    const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);
    const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
    const customerList = unwrap<PartyDTO[]>(customerResult);
    const itemList = unwrap<InventoryItemDTO[]>(itemResult);
    const salesOrderList = unwrap<SalesOrderDTO[]>(salesOrderResult);

    setSettings(currentSettings);
    setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
    setCustomers(Array.isArray(customerList) ? customerList : []);
    setItems(Array.isArray(itemList) ? itemList : []);
    setSalesOrders(Array.isArray(salesOrderList) ? salesOrderList : []);

    return currentSettings;
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
    } catch (loadError) {
      console.error('Failed to load UOM conversions', loadError);
      setUomOptionsByItemId((current) => ({
        ...current,
        [itemId]: buildItemUomOptions(itemById[itemId], []),
      }));
    }
  };

  const loadSalesOrderLines = async (orderId: string) => {
    const trimmedOrderId = orderId.trim();
    if (!trimmedOrderId) return;

    try {
      setOrderLineLoading(true);
      setError(null);

      const orderResult = await salesApi.getSO(trimmedOrderId);
      const so = unwrap<SalesOrderDTO>(orderResult);
      const nextLines = toEditableLinesFromSalesOrder(so);

      setForm((prev) => ({
        ...prev,
        salesOrderId: trimmedOrderId,
        customerId: so.customerId,
        lines: nextLines.length ? nextLines : [createEmptyLine()],
      }));
    } catch (err: any) {
      console.error('Failed to load sales order lines', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales order lines.'
      );
    } finally {
      setOrderLineLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentSettings = await loadReferenceData();
      const defaultWarehouseId = currentSettings?.defaultWarehouseId || '';

      if (!isCreateMode && params.id) {
        const result = await salesApi.getDN(params.id);
        const loaded = unwrap<DeliveryNoteDTO>(result);
        setDeliveryNote(loaded);
      } else {
        setDeliveryNote(null);
        setForm(createEmptyForm(initialSalesOrderId, initialCustomerId, defaultWarehouseId));
        if (initialSalesOrderId) {
          await loadSalesOrderLines(initialSalesOrderId);
        }
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

  useEffect(() => {
    const ids = Array.from(new Set(form.lines.map((line) => line.itemId).filter(Boolean)));
    ids.forEach((itemId) => {
      void ensureItemUomOptions(itemId);
    });
  }, [form.lines, itemById]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (!next.warehouseId && settings?.defaultWarehouseId) {
            next.warehouseId = settings.defaultWarehouseId;
          }
        } else {
          next.itemCode = undefined;
          next.itemName = undefined;
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
      return {
        ...prev,
        lines: prev.lines.filter((_, idx) => idx !== index),
      };
    });
  };

  const validateBeforeSave = (): string | null => {
    if (!form.deliveryDate) return 'Delivery date is required.';
    if (!form.warehouseId) return 'Warehouse is required.';
    if (!form.salesOrderId && !form.customerId) return 'Customer is required when sales order is not provided.';

    if (!form.salesOrderId) {
      if (!form.lines.length) return 'At least one line is required for direct delivery notes.';
      for (let i = 0; i < form.lines.length; i += 1) {
        const line = form.lines[i];
        if (!line.itemId) return `Line ${i + 1}: item is required.`;
        if (Number.isNaN(line.deliveredQty) || line.deliveredQty <= 0) {
          return `Line ${i + 1}: delivered quantity must be greater than 0.`;
        }
      }
    }

    return null;
  };

  const buildLinePayload = (line: EditableLine, index: number): DeliveryNoteLineInputDTO => {
    const item = itemById[line.itemId];
    const payload = {
      lineId: line.lineId,
      lineNo: index + 1,
      soLineId: line.soLineId || undefined,
      itemId: line.itemId || undefined,
      deliveredQty: line.deliveredQty,
      uomId: line.uomId,
      uom: line.uom || item?.salesUom || item?.baseUom || 'EA',
      warehouseId: line.warehouseId || undefined,
      description: line.description || undefined,
    };
    return payload;
  };

  const createDraft = async () => {
    const validationError = validateBeforeSave();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setBusy(true);
      setError(null);

      const mappedLines = form.lines
        .filter((line) => line.itemId && line.deliveredQty > 0)
        .map((line, index) => buildLinePayload(line, index));

      const created = await salesApi.createDN({
        salesOrderId: form.salesOrderId || undefined,
        customerId: form.salesOrderId ? undefined : form.customerId || undefined,
        deliveryDate: form.deliveryDate,
        warehouseId: form.warehouseId,
        lines: mappedLines.length ? mappedLines : undefined,
        notes: form.notes || undefined,
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Sales Order (optional unless SO is required for stock items)</label>
              <div className="flex gap-2">
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={form.salesOrderId}
                  onChange={(e) => setForm((prev) => ({ ...prev, salesOrderId: e.target.value }))}
                >
                  <option value="">No sales order</option>
                  {salesOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.customerName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-50"
                  onClick={() => loadSalesOrderLines(form.salesOrderId)}
                  disabled={busy || orderLineLoading || !form.salesOrderId.trim()}
                >
                  {orderLineLoading ? 'Loading...' : 'Load SO Lines'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Customer (standalone)</label>
              <PartySelector 
                value={form.customerId}
                disabled={!!form.salesOrderId}
                onChange={(party) => {
                  setForm((prev) => ({
                    ...prev,
                    customerId: party?.id || '',
                  }));
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Delivery Date</label>
              <DatePicker 
                value={form.deliveryDate}
                onChange={(val) => setForm((prev) => ({ ...prev, deliveryDate: val }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Warehouse</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.warehouseId}
                onChange={(e) => setForm((prev) => ({ ...prev, warehouseId: e.target.value }))}
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
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {settings?.requireSOForStockItems && !form.salesOrderId && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              This company requires a Sales Order reference for stock-item delivery flow.
            </div>
          )}

          <div className="mt-4 text-xs text-slate-500">
            When a Sales Order is selected, lines can be loaded from the order or pre-filled by server rules.
          </div>
        </Card>

        {!form.salesOrderId && (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Line Items</h2>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
                onClick={addLine}
                disabled={busy}
              >
                Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-left">Item</th>
                    <th className="py-2 text-right">Delivered Qty</th>
                    <th className="py-2 text-left">UOM</th>
                    <th className="py-2 text-left">Warehouse</th>
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
                          value={line.deliveredQty}
                          onChange={(e) => setLine(index, { deliveredQty: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 uppercase"
                          value={
                            findItemUomOption(uomOptionsByItemId[line.itemId] || [], line.uomId, line.uom)?.uomId ||
                            line.uomId ||
                            line.uom
                          }
                          disabled={!line.itemId}
                          onChange={(e) => {
                            const selected = (uomOptionsByItemId[line.itemId] || []).find(
                              (option) => (option.uomId || option.code) === e.target.value
                            );
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
                        <select
                          className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          value={line.warehouseId || ''}
                          disabled={busy}
                          onChange={(e) => setLine(index, { warehouseId: e.target.value || undefined })}
                        >
                          <option value="">Select Warehouse</option>
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                          onClick={() => removeLine(index)}
                          disabled={busy || form.lines.length <= 1}
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
        )}

        <button
          type="button"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={createDraft}
          disabled={busy || orderLineLoading}
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

  const canCreateReturn = deliveryNote.status === 'POSTED' && !!settings?.requireSOForStockItems;
  const createReturnHref = `/sales/returns/new?deliveryNoteId=${encodeURIComponent(deliveryNote.id)}${deliveryNote.salesOrderId ? `&salesOrderId=${encodeURIComponent(deliveryNote.salesOrderId)}` : ''}`;

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{deliveryNote.dnNumber}</h1>
          <p className="text-sm text-slate-600">
            Customer: <span className="font-medium">{deliveryNote.customerName}</span>
            {deliveryNote.salesOrderId
              ? ` • SO: ${salesOrderLabelById[deliveryNote.salesOrderId] || deliveryNote.salesOrderId}`
              : ''}
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

